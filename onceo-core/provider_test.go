package onceo

import (
	"context"
	"crypto/rand"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"
)

type testProviderData struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type testProvider struct {
	name            string
	verifyErr       error
	parseResult     testProviderData
	parseErr        error
	normalizeResult Event
	normalizeErr    error
	providerEventID string
}

func (p *testProvider) Name() string { return p.name }

func (p *testProvider) BodyBound() bool { return true }

func (p *testProvider) VerifySignature(_ http.Header, _ []byte) error {
	return p.verifyErr
}

func (p *testProvider) Parse(_ []byte) (testProviderData, error) {
	return p.parseResult, p.parseErr
}

func (p *testProvider) Normalize(_ testProviderData) (Event, error) {
	return p.normalizeResult, p.normalizeErr
}

func TestProcessSuccess(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			ID:              "evt_001",
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
			AmountMinor:     50000,
			Currency:        "NGN",
			Reference:       "ref_001",
			ReceivedAt:      time.Now().UTC(),
		},
	}

	event, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}
	if event.ProviderEventID != "evt_001" {
		t.Errorf("expected ProviderEventID evt_001, got %s", event.ProviderEventID)
	}

	created, err := store.SaveIfNew(ctx, event)
	if err != nil {
		t.Fatalf("SaveIfNew failed: %v", err)
	}
	if created {
		t.Error("expected event to already be stored")
	}
}

func TestProcessBadSignature(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	provider := &testProvider{
		name:      "test",
		verifyErr: ErrInvalidSignature,
	}

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if !errors.Is(err, ErrInvalidSignature) {
		t.Errorf("expected ErrInvalidSignature, got %v", err)
	}
}

func TestProcessDuplicate(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			ID:              "evt_001",
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
			AmountMinor:     50000,
			Currency:        "NGN",
			Reference:       "ref_001",
			ReceivedAt:      time.Now().UTC(),
		},
	}

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err != nil {
		t.Fatalf("first Process failed: %v", err)
	}

	_, err = Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if !errors.Is(err, ErrDuplicateEvent) {
		t.Errorf("expected ErrDuplicateEvent, got %v", err)
	}
}

func TestProcessContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	store := NewMemoryStore()
	provider := &testProvider{name: "test"}

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Error("expected error from cancelled context")
	}
}

func TestProcessProviderErrorWrapping(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	provider := &testProvider{
		name:      "testrail",
		verifyErr: ErrInvalidSignature,
	}

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))

	var pErr *ProviderError
	if !errors.As(err, &pErr) {
		t.Fatal("expected *ProviderError")
	}
	if pErr.Provider != "testrail" {
		t.Errorf("expected provider testrail, got %s", pErr.Provider)
	}
}

func TestGenerateIDError(t *testing.T) {
	_, err := generateID(&failReader{})
	if err == nil {
		t.Fatal("expected error from failing reader")
	}
}

type failReader struct{}

func (f *failReader) Read(p []byte) (int, error) {
	return 0, errors.New("read failure")
}

func TestProcessGenerateIDError(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
			AmountMinor:     1000,
		},
	}
	store := NewMemoryStore()
	origRand := rand.Reader
	rand.Reader = &failReader{}
	defer func() { rand.Reader = origRand }()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error from generateID failure")
	}
}

func TestProcessBodyTooLarge(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{name: "test"}
	store := NewMemoryStore()

	bigBody := make([]byte, MaxBodySize+1)
	_, err := Process(ctx, provider, store, http.Header{}, bigBody)
	if err == nil {
		t.Error("expected error for body exceeding max size")
	}
}

func TestProcessEmptyBody(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{name: "test", verifyErr: ErrInvalidSignature}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte{})
	if err == nil {
		t.Error("expected error for missing signature")
	}
}

func TestProcessParseError(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:     "test",
		parseErr: errors.New("parse failure"),
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error from parse failure")
	}
}

func TestProcessNormalizeError(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:         "test",
		normalizeErr: errors.New("normalize failure"),
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error from normalize failure")
	}
}

func TestProcessEmptyProviderEventID(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "",
			Type:            "charge.success",
			Status:          StatusSuccess,
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for empty ProviderEventID")
	}
}

func TestProcessInvalidProviderNameColon(t *testing.T) {
	ctx := context.Background()
	provider := &colonsNameProvider{
		normalizeResult: Event{
			Provider:        "pay:stack",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for provider name containing colon")
	}
}

func TestProcessInvalidProviderNameBackslash(t *testing.T) {
	ctx := context.Background()
	provider := &backslashNameProvider{
		normalizeResult: Event{
			Provider:        "pay\\stack",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for provider name containing backslash")
	}
}

func TestProcessStoreError(t *testing.T) {
	ctx := context.Background()
	provider := &emptyNameProvider{
		normalizeResult: Event{
			Provider:        "",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error from SaveIfNew failure (empty provider name)")
	}
}

type colonsNameProvider struct {
	normalizeResult Event
	normalizeErr    error
}

func (p *colonsNameProvider) Name() string                                  { return "pay:stack" }
func (p *colonsNameProvider) BodyBound() bool                               { return true }
func (p *colonsNameProvider) VerifySignature(_ http.Header, _ []byte) error { return nil }
func (p *colonsNameProvider) Parse(_ []byte) (testProviderData, error) {
	return testProviderData{}, nil
}
func (p *colonsNameProvider) Normalize(_ testProviderData) (Event, error) {
	return p.normalizeResult, p.normalizeErr
}

type backslashNameProvider struct {
	normalizeResult Event
	normalizeErr    error
}

func (p *backslashNameProvider) Name() string                                  { return "pay\\stack" }
func (p *backslashNameProvider) BodyBound() bool                               { return true }
func (p *backslashNameProvider) VerifySignature(_ http.Header, _ []byte) error { return nil }
func (p *backslashNameProvider) Parse(_ []byte) (testProviderData, error) {
	return testProviderData{}, nil
}
func (p *backslashNameProvider) Normalize(_ testProviderData) (Event, error) {
	return p.normalizeResult, p.normalizeErr
}

type emptyNameProvider struct {
	normalizeResult Event
	normalizeErr    error
}

func (p *emptyNameProvider) Name() string                                  { return "" }
func (p *emptyNameProvider) BodyBound() bool                               { return true }
func (p *emptyNameProvider) VerifySignature(_ http.Header, _ []byte) error { return nil }
func (p *emptyNameProvider) Parse(_ []byte) (testProviderData, error)      { return testProviderData{}, nil }
func (p *emptyNameProvider) Normalize(_ testProviderData) (Event, error) {
	return p.normalizeResult, p.normalizeErr
}

func TestProcessEmptyType(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "",
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for empty event type")
	}
}

func TestProcessNegativeAmount(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			AmountMinor:     -1,
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for negative amount")
	}
}

func TestProcessInvalidCurrencyLength(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			AmountMinor:     1000,
			Currency:        "XXXX",
		},
	}
	store := NewMemoryStore()

	_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err == nil {
		t.Fatal("expected error for invalid currency length")
	}
}

func TestProcessSetsID(t *testing.T) {
	ctx := context.Background()
	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_001",
		normalizeResult: Event{
			Provider:        "test",
			ProviderEventID: "evt_001",
			Type:            "charge.success",
			Status:          StatusSuccess,
		},
	}
	store := NewMemoryStore()

	event, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}
	if event.ID == "" {
		t.Error("expected Event.ID to be set by Process")
	}
	if len(event.RawPayload) == 0 {
		t.Error("expected RawPayload to be set by Process")
	}
	if event.ProcessedAt.IsZero() {
		t.Error("expected ProcessedAt to be set by Process")
	}
}

func TestProcessConcurrentDuplicateDelivery(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	provider := &testProvider{
		name:            "test",
		providerEventID: "evt_concurrent",
		normalizeResult: Event{
			ID:              "evt_concurrent",
			Provider:        "test",
			ProviderEventID: "evt_concurrent",
			Type:            "charge.success",
			Status:          StatusSuccess,
			AmountMinor:     50000,
			Currency:        "NGN",
			Reference:       "ref_concurrent",
			ReceivedAt:      time.Now().UTC(),
		},
	}

	const goroutines = 32
	var wg sync.WaitGroup
	results := make(chan error, goroutines)
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := Process(ctx, provider, store, http.Header{}, []byte(`{}`))
			results <- err
		}()
	}
	wg.Wait()
	close(results)

	created, duplicates := 0, 0
	for err := range results {
		if err == nil {
			created++
		} else if errors.Is(err, ErrDuplicateEvent) {
			duplicates++
		} else {
			t.Fatalf("unexpected error from Process: %v", err)
		}
	}

	if created != 1 {
		t.Errorf("expected exactly 1 created event, got %d (duplicates=%d)", created, duplicates)
	}
	if duplicates != goroutines-1 {
		t.Errorf("expected %d duplicate rejections, got %d", goroutines-1, duplicates)
	}
}
