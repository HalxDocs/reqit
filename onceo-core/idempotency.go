package onceo

import (
	"container/list"
	"context"
	"fmt"
	"strings"
	"sync"
)

const DefaultMaxMemoryEvents = 100000

// keyScope is the delimiter used to join a store namespace (tenant/account)
// with the derived provider:providerEventID key when a namespace is set.
const keyScope = "::"

// Store provides atomic idempotency — exactly-one delivery semantics
// for webhook events. Implementations MUST make SaveIfNew atomic: no
// caller-visible window where two concurrent calls for the same key can
// both return created=true.
//
// WARNING: Implementations that cap storage without a TTL (e.g., a
// fixed-size ring buffer) violate the exactly-one contract. Once an
// event is evicted, a subsequent SaveIfNew for the same key returns
// created=true again, producing a duplicate. In-memory stores are
// suitable only for tests and local development.
type Store interface {
	SaveIfNew(ctx context.Context, e Event) (created bool, err error)
}

// MemoryStore is an in-memory Store, safe for concurrent use within a
// single process. By default it is unbounded, so it NEVER silently forgets
// a dedup key: exactly-once semantics hold for the lifetime of the process.
// It is intended for tests and local development.
//
// The bounded variant NewMemoryStoreWithMax caps memory but sacrifices the
// exactly-once contract: when the cap is reached the oldest entry is evicted
// and a subsequent SaveIfNew for the evicted key returns created=true again,
// producing a duplicate. Use a durable Store implementation (store/redis)
// with a TTL matching your reconciliation window for production.
type MemoryStore struct {
	mu       sync.Mutex
	events   map[string]Event
	order    *list.List
	maxItems int
	// namespace isolates one account/tenant from another. Two events that
	// share a provider + providerEventID but belong to different namespaces
	// are stored under different keys and never deduped against each other.
	// It must be empty, or safe for the key format (no ':' or '\\').
	namespace string
}

// NewMemoryStore returns an unbounded in-memory store. It never evicts, so
// exactly-once semantics hold for the lifetime of the process. Suitable only
// for tests and local development: events are lost on restart.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		events:   make(map[string]Event),
		order:    list.New(),
		maxItems: 0, // unbounded: never evicts, never silently duplicates
	}
}

// NewMemoryStoreWithMax returns a bounded in-memory store that stops storing
// events once max is reached. When at capacity the oldest entry is evicted
// to make room, which SILENTLY BREAKS exactly-once: a later SaveIfNew for an
// evicted key returns created=true again. Prefer an unbounded MemoryStore or
// a durable Store with a TTL for production.
func NewMemoryStoreWithMax(max int) *MemoryStore {
	if max <= 0 {
		max = DefaultMaxMemoryEvents
	}
	return &MemoryStore{
		events:   make(map[string]Event),
		order:    list.New(),
		maxItems: max,
	}
}

// NewMemoryStoreWithNamespace returns a store that namespaces its dedup keys
// by ns. This prevents events from different accounts/tenants sharing one
// store from colliding when they use the same provider + providerEventID.
func NewMemoryStoreWithNamespace(ns string) (*MemoryStore, error) {
	if err := validateNamespace(ns); err != nil {
		return nil, err
	}
	s := NewMemoryStore()
	s.namespace = ns
	return s, nil
}

func validateNamespace(ns string) error {
	if ns == "" {
		return nil
	}
	if strings.ContainsAny(ns, ":\\") {
		return fmt.Errorf("namespace %q must not contain ':' or '\\'", ns)
	}
	return nil
}

// scopeKey joins a namespace with an escaped provider:providerEventID key.
// The provider/eventID segment uses the same escaping as before so key
// collides remain impossible; the namespace is a separate, non-escapable
// prefix that isolates accounts/tenants sharing one store.
func scopeKey(namespace, provider, providerEventID string) string {
	escapedProvider := strings.ReplaceAll(provider, "\\", "\\\\")
	escapedProvider = strings.ReplaceAll(escapedProvider, ":", "\\:")
	escapedID := strings.ReplaceAll(providerEventID, "\\", "\\\\")
	escapedID = strings.ReplaceAll(escapedID, ":", "\\:")
	key := escapedProvider + ":" + escapedID
	if namespace != "" {
		key = namespace + keyScope + key
	}
	return key
}

func (s *MemoryStore) eventKey(provider, providerEventID string) string {
	key := scopeKey(s.namespace, provider, providerEventID)
	return key
}

func (s *MemoryStore) SaveIfNew(ctx context.Context, e Event) (bool, error) {
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	default:
	}

	if e.Provider == "" || e.ProviderEventID == "" {
		return false, fmt.Errorf("%w: provider and provider event id must not be empty", ErrStoreFailed)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	key := s.eventKey(e.Provider, e.ProviderEventID)
	if _, exists := s.events[key]; exists {
		return false, nil
	}

	if s.maxItems > 0 && len(s.events) >= s.maxItems {
		for s.order.Len() > 0 {
			oldest := s.order.Front()
			oldKey, ok := oldest.Value.(string)
			if !ok {
				s.order.Remove(oldest)
				continue
			}
			delete(s.events, oldKey)
			s.order.Remove(oldest)
			break
		}
	}

	s.events[key] = e
	s.order.PushBack(key)
	return true, nil
}
