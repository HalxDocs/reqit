package redisstore

import (
	"context"
	"testing"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/redis/go-redis/v9"
)

func newTestClient(t *testing.T) *redis.Client {
	t.Helper()
	client := redis.NewClient(&redis.Options{
		Addr:         "localhost:6379",
		DB:           1,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("redis not available:", err)
	}
	return client
}

func cleanup(t *testing.T, client *redis.Client) {
	t.Helper()
	if err := client.FlushDB(context.Background()).Err(); err != nil {
		t.Fatalf("flush failed: %v", err)
	}
}

func TestRedisStoreSaveIfNew(t *testing.T) {
	client := newTestClient(t)
	defer client.Close()
	defer cleanup(t, client)

	ctx := context.Background()
	store := New(client)

	event := onceo.Event{
		ID:              "evt_001",
		Provider:        "paystack",
		ProviderEventID: "evt_001",
		Type:            "charge.success",
		Status:          onceo.StatusSuccess,
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
		t.Error("expected duplicate to return created=false")
	}
}

func TestRedisStoreContextCancel(t *testing.T) {
	client := newTestClient(t)
	defer client.Close()
	defer cleanup(t, client)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	store := New(client)

	_, err := store.SaveIfNew(ctx, onceo.Event{Provider: "t", ProviderEventID: "1"})
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}

func TestRedisStoreEmptyProvider(t *testing.T) {
	store := &Store{}
	_, err := store.SaveIfNew(context.Background(), onceo.Event{Provider: "", ProviderEventID: "1"})
	if err == nil {
		t.Error("expected error for empty provider")
	}
	_, err = store.SaveIfNew(context.Background(), onceo.Event{Provider: "paystack", ProviderEventID: ""})
	if err == nil {
		t.Error("expected error for empty provider event id")
	}
}

func TestRedisStoreClose(t *testing.T) {
	client := newTestClient(t)
	store := New(client)
	if err := store.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}
}

func TestRedisStoreSaveIfNewWithClosedClient(t *testing.T) {
	client := newTestClient(t)
	store := New(client)
	store.Close()

	_, err := store.SaveIfNew(context.Background(), onceo.Event{
		Provider: "test", ProviderEventID: "evt_001",
		Type: "charge.success", Status: onceo.StatusSuccess,
	})
	if err == nil {
		t.Fatal("expected error with closed redis client")
	}
}

func TestRedisStoreTTL(t *testing.T) {
	client := newTestClient(t)
	defer client.Close()
	defer cleanup(t, client)

	ctx := context.Background()
	store := NewWithTTL(client, 1*time.Second)

	event := onceo.Event{
		ID: "evt_001", Provider: "paystack", ProviderEventID: "evt_001",
		Type: "charge.success", Status: onceo.StatusSuccess,
		AmountMinor: 50000, Currency: "NGN", Reference: "ref_001",
		ReceivedAt: time.Now().UTC(),
	}

	created, err := store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if !created {
		t.Fatal("expected event to be created")
	}

	time.Sleep(2 * time.Second)

	created, err = store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if !created {
		t.Error("expected event to expire and be re-creatable after TTL")
	}
}

func TestRedisStoreKeyIncludesNamespace(t *testing.T) {
	nsStore, err := NewWithNamespace(&redis.Client{}, "acct_1")
	if err != nil {
		t.Fatalf("NewWithNamespace failed: %v", err)
	}
	plain := New(&redis.Client{})
	if got := key(nsStore.namespace, "paystack", "evt_001"); got != "onceo:event:acct_1::paystack:evt_001" {
		t.Errorf("namespaced key = %q", got)
	}
	if got := key(plain.namespace, "paystack", "evt_001"); got != "onceo:event:paystack:evt_001" {
		t.Errorf("un-namespaced key = %q", got)
	}
	if nsStore.namespace != "acct_1" {
		t.Errorf("namespace = %q, want acct_1", nsStore.namespace)
	}
}

func TestRedisStoreNamespaceIsolation(t *testing.T) {
	client := newTestClient(t)
	defer client.Close()
	defer cleanup(t, client)

	ctx := context.Background()
	nsA, err := NewWithNamespace(client, "tenant_a")
	if err != nil {
		t.Fatalf("NewWithNamespace failed: %v", err)
	}
	nsB, err := NewWithNamespace(client, "tenant_b")
	if err != nil {
		t.Fatalf("NewWithNamespace failed: %v", err)
	}

	event := onceo.Event{
		ID: "evt_001", Provider: "paystack", ProviderEventID: "evt_001",
		Type: "charge.success", Status: onceo.StatusSuccess,
		AmountMinor: 50000, Currency: "NGN", Reference: "ref_001",
		ReceivedAt: time.Now().UTC(),
	}

	ca, err := nsA.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("nsA SaveIfNew failed: %v", err)
	}
	cb, err := nsB.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("nsB SaveIfNew failed: %v", err)
	}
	if !ca || !cb {
		t.Fatalf("expected both namespaces to create, got %v/%v", ca, cb)
	}

	ca2, err := nsA.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("nsA second SaveIfNew failed: %v", err)
	}
	cb2, err := nsB.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("nsB second SaveIfNew failed: %v", err)
	}
	if ca2 {
		t.Error("expected nsA duplicate to be rejected")
	}
	if cb2 {
		t.Error("expected nsB duplicate to be rejected")
	}
}

func TestNewWithNamespaceInvalid(t *testing.T) {
	if _, err := NewWithNamespace(&redis.Client{}, "bad:name"); err == nil {
		t.Error("expected error for namespace containing ':'")
	}
	if _, err := NewWithNamespace(&redis.Client{}, "bad\\name"); err == nil {
		t.Error("expected error for namespace containing '\\'")
	}
	s, err := NewWithNamespace(&redis.Client{}, "")
	if err != nil {
		t.Fatalf("empty namespace should be allowed: %v", err)
	}
	if s.namespace != "" {
		t.Error("empty namespace should leave namespace unset")
	}
}
