package redisstore

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/redis/go-redis/v9"
)

const (
	prefix     = "onceo:event:"
	defaultTTL = 7 * 24 * time.Hour
)

type Store struct {
	client *redis.Client
	ttl    time.Duration
	// namespace isolates one account/tenant from the dedup keys of another
	// when a single Redis instance is shared across tenants.
	namespace string
}

func New(client *redis.Client) *Store {
	return &Store{
		client: client,
		ttl:    defaultTTL,
	}
}

func NewWithTTL(client *redis.Client, ttl time.Duration) *Store {
	return &Store{
		client: client,
		ttl:    ttl,
	}
}

// NewWithNamespace returns a store whose dedup keys carry the given
// namespace. Use a distinct namespace per account/tenant so identical
// provider + providerEventID values from different tenants cannot collide.
func NewWithNamespace(client *redis.Client, namespace string) (*Store, error) {
	if namespace == "" {
		return New(client), nil
	}
	if strings.ContainsAny(namespace, ":\\") {
		return nil, fmt.Errorf("namespace %q must not contain ':' or '\\'", namespace)
	}
	return &Store{
		client:    client,
		ttl:       defaultTTL,
		namespace: namespace,
	}, nil
}

func key(namespace, provider, providerEventID string) string {
	escapedProvider := strings.ReplaceAll(provider, "\\", "\\\\")
	escapedProvider = strings.ReplaceAll(escapedProvider, ":", "\\:")
	escaped := strings.ReplaceAll(providerEventID, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, ":", "\\:")
	k := prefix + escapedProvider + ":" + escaped
	if namespace != "" {
		k = prefix + namespace + "::" + escapedProvider + ":" + escaped
	}
	return k
}

func (s *Store) Close() error {
	return s.client.Close()
}

func (s *Store) SaveIfNew(ctx context.Context, e onceo.Event) (bool, error) {
	if e.Provider == "" || e.ProviderEventID == "" {
		return false, fmt.Errorf("%w: provider and provider event id must not be empty", onceo.ErrStoreFailed)
	}
	if strings.ContainsAny(e.Provider, ":\\") {
		return false, fmt.Errorf("%w: provider name %q contains reserved character", onceo.ErrStoreFailed, e.Provider)
	}
	if strings.ContainsAny(e.ProviderEventID, ":\\") {
		return false, fmt.Errorf("%w: provider event id %q contains reserved character", onceo.ErrStoreFailed, e.ProviderEventID)
	}

	data, err := json.Marshal(e)
	if err != nil {
		return false, fmt.Errorf("%w: marshal event: %w", onceo.ErrStoreFailed, err)
	}

	k := key(s.namespace, e.Provider, e.ProviderEventID)
	ok, err := s.client.SetNX(ctx, k, data, s.ttl).Result()
	if err != nil {
		return false, fmt.Errorf("%w: redis setnx: %w", onceo.ErrStoreFailed, err)
	}
	return ok, nil
}
