package onceo

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestMemoryStoreSaveIfNew(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	event := Event{
		ID:              "evt_001",
		Provider:        "paystack",
		ProviderEventID: "evt_001",
		Type:            "charge.success",
		Status:          StatusSuccess,
		AmountMinor:     50000,
		Currency:        "NGN",
		Reference:       "ref_001",
		ReceivedAt:      time.Now().UTC(),
	}

	created, err := store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if !created {
		t.Error("expected event to be created")
	}

	created, err = store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if created {
		t.Error("expected event NOT to be created on duplicate")
	}
}

func TestMemoryStoreDuplicateRejection(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	event := Event{
		ID:              "evt_001",
		Provider:        "paystack",
		ProviderEventID: "evt_001",
		Type:            "charge.success",
		Status:          StatusSuccess,
		AmountMinor:     50000,
		Currency:        "NGN",
		Reference:       "ref_001",
		ReceivedAt:      time.Now().UTC(),
	}

	created, err := store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("first SaveIfNew failed: %v", err)
	}
	if !created {
		t.Fatal("expected first to be created")
	}

	created, err = store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("second SaveIfNew failed: %v", err)
	}
	if created {
		t.Fatal("expected duplicate to return created=false")
	}
}

func TestMemoryStoreConcurrent(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			event := Event{
				ID:              "evt_001",
				Provider:        "paystack",
				ProviderEventID: "evt_001",
				Type:            "charge.success",
				Status:          StatusSuccess,
				AmountMinor:     int64(i),
				Currency:        "NGN",
				Reference:       "ref_001",
				ReceivedAt:      time.Now().UTC(),
			}
			_, _ = store.SaveIfNew(ctx, event)
		}(i)
	}
	wg.Wait()

	events := store.events
	if len(events) != 1 {
		t.Errorf("expected exactly 1 event saved, got %d", len(events))
	}
}

func TestMemoryStoreContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	store := NewMemoryStore()

	_, err := store.SaveIfNew(ctx, Event{Provider: "t", ProviderEventID: "1"})
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}

func TestMemoryStoreWithMax(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStoreWithMax(2)

	e1 := Event{ID: "1", Provider: "p", ProviderEventID: "1", ReceivedAt: time.Now().UTC()}
	e2 := Event{ID: "2", Provider: "p", ProviderEventID: "2", ReceivedAt: time.Now().UTC()}
	e3 := Event{ID: "3", Provider: "p", ProviderEventID: "3", ReceivedAt: time.Now().UTC()}

	if _, err := store.SaveIfNew(ctx, e1); err != nil {
		t.Fatalf("SaveIfNew e1 failed: %v", err)
	}
	if _, err := store.SaveIfNew(ctx, e2); err != nil {
		t.Fatalf("SaveIfNew e2 failed: %v", err)
	}
	if _, err := store.SaveIfNew(ctx, e3); err != nil {
		t.Fatalf("SaveIfNew e3 failed: %v", err)
	}

	created, err := store.SaveIfNew(ctx, e1)
	if err != nil {
		t.Fatalf("SaveIfNew e1 check failed: %v", err)
	}
	if !created {
		t.Error("e1 should have been evicted and re-created")
	}

	created, err = store.SaveIfNew(ctx, e3)
	if err != nil {
		t.Fatalf("SaveIfNew e3 check failed: %v", err)
	}
	if created {
		t.Error("e3 should already be present")
	}
}

func TestMemoryStoreWithMaxZero(t *testing.T) {
	store := NewMemoryStoreWithMax(0)
	if store.maxItems != DefaultMaxMemoryEvents {
		t.Errorf("maxItems = %d, want %d", store.maxItems, DefaultMaxMemoryEvents)
	}
}

func TestMemoryStoreEmptyProviderOrEventID(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	_, err := store.SaveIfNew(ctx, Event{Provider: "", ProviderEventID: "1"})
	if err == nil {
		t.Error("expected error for empty provider")
	}

	_, err = store.SaveIfNew(ctx, Event{Provider: "paystack", ProviderEventID: ""})
	if err == nil {
		t.Error("expected error for empty provider event id")
	}
}

func TestMemoryStoreDifferentProviders(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	e1 := Event{
		ID: "evt_001", Provider: "paystack", ProviderEventID: "evt_001",
		Type: "charge.success", Status: StatusSuccess,
		AmountMinor: 1000, Currency: "NGN", Reference: "ref_001",
		ReceivedAt: time.Now().UTC(),
	}
	e2 := Event{
		ID: "evt_001", Provider: "flutterwave", ProviderEventID: "evt_001",
		Type: "charge.success", Status: StatusSuccess,
		AmountMinor: 2000, Currency: "NGN", Reference: "ref_002",
		ReceivedAt: time.Now().UTC(),
	}

	created1, err := store.SaveIfNew(ctx, e1)
	if err != nil {
		t.Fatalf("SaveIfNew e1 failed: %v", err)
	}
	if !created1 {
		t.Error("expected e1 to be created")
	}

	created2, err := store.SaveIfNew(ctx, e2)
	if err != nil {
		t.Fatalf("SaveIfNew e2 failed: %v", err)
	}
	if !created2 {
		t.Error("expected e2 to be created")
	}
}

func TestMemoryStoreNamespaceIsolation(t *testing.T) {
	ctx := context.Background()

	nsA, err := NewMemoryStoreWithNamespace("tenant_a")
	if err != nil {
		t.Fatalf("NewMemoryStoreWithNamespace failed: %v", err)
	}
	nsB, err := NewMemoryStoreWithNamespace("tenant_b")
	if err != nil {
		t.Fatalf("NewMemoryStoreWithNamespace failed: %v", err)
	}

	evt := Event{
		ID: "evt_001", Provider: "paystack", ProviderEventID: "evt_001",
		Type: "charge.success", Status: StatusSuccess,
		AmountMinor: 1000, Currency: "NGN", Reference: "ref_001",
		ReceivedAt: time.Now().UTC(),
	}

	// Same provider+id in two namespaces must both be created: no cross-tenant collision.
	ca, err := nsA.SaveIfNew(ctx, evt)
	if err != nil {
		t.Fatalf("nsA SaveIfNew failed: %v", err)
	}
	cb, err := nsB.SaveIfNew(ctx, evt)
	if err != nil {
		t.Fatalf("nsB SaveIfNew failed: %v", err)
	}
	if !ca || !cb {
		t.Fatalf("expected both namespaces to create event, got %v/%v", ca, cb)
	}

	// Dedup is per-namespace: repeat in A is a duplicate, repeat in B is a duplicate.
	ca2, err := nsA.SaveIfNew(ctx, evt)
	if err != nil {
		t.Fatalf("nsA SaveIfNew (2nd) failed: %v", err)
	}
	cb2, err := nsB.SaveIfNew(ctx, evt)
	if err != nil {
		t.Fatalf("nsB SaveIfNew (2nd) failed: %v", err)
	}
	if ca2 {
		t.Error("expected nsA second save to be a duplicate")
	}
	if cb2 {
		t.Error("expected nsB second save to be a duplicate")
	}
}

func TestNewMemoryStoreWithNamespaceInvalid(t *testing.T) {
	if _, err := NewMemoryStoreWithNamespace("bad:name"); err == nil {
		t.Error("expected error for namespace containing ':'")
	}
	if _, err := NewMemoryStoreWithNamespace("bad\\name"); err == nil {
		t.Error("expected error for namespace containing '\\'")
	}
	if s, err := NewMemoryStoreWithNamespace(""); err == nil && s.namespace != "" {
		t.Error("empty namespace should keep namespace unset")
	}
}

func TestMemoryStoreNamespaceAgainstDefaultIsolated(t *testing.T) {
	ctx := context.Background()
	defaultStore := NewMemoryStore()
	nsStore, err := NewMemoryStoreWithNamespace("acct_1")
	if err != nil {
		t.Fatalf("NewMemoryStoreWithNamespace failed: %v", err)
	}
	evt := Event{
		Provider: "paystack", ProviderEventID: "evt_001",
		Type: "charge.success", Status: StatusSuccess, ReceivedAt: time.Now().UTC(),
	}
	if _, err := defaultStore.SaveIfNew(ctx, evt); err != nil {
		t.Fatalf("default SaveIfNew failed: %v", err)
	}
	created, err := nsStore.SaveIfNew(ctx, evt)
	if err != nil {
		t.Fatalf("ns SaveIfNew failed: %v", err)
	}
	if !created {
		t.Error("expected namespaced store to treat same event as new")
	}
}

func TestMemoryStoreEvictionNonStringElement(t *testing.T) {
	store := NewMemoryStoreWithMax(1)
	ctx := context.Background()

	_, err := store.SaveIfNew(ctx, Event{
		Provider:        "test",
		ProviderEventID: "evt_001",
		Type:            "charge.success",
		ReceivedAt:      time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}

	store.order.PushFront(42)

	_, err = store.SaveIfNew(ctx, Event{
		Provider:        "test",
		ProviderEventID: "evt_002",
		Type:            "charge.success",
		ReceivedAt:      time.Now().UTC(),
	})
	if err != nil {
		t.Fatal("expected non-string element to be cleaned up silently, got error")
	}

	created, err := store.SaveIfNew(ctx, Event{
		Provider:        "test",
		ProviderEventID: "evt_001",
		Type:            "charge.success",
		ReceivedAt:      time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if !created {
		t.Error("evt_001 should have been evicted and should be re-creatable")
	}
}
