package eventinspector

import (
	"context"
	"net/http"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/providers/svix"

	"flux/internal/models"
)

// Verify runs a captured webhook through signature verification (via
// onceo-core's svix provider) and dedupe, returning a VerifyResult.
//
//   - No secret configured -> "unverified" with a hint (still captured).
//   - Signature fails      -> "unverified" with the underlying error.
//   - svix-id already seen -> "duplicate".
//   - Signature valid      -> "verified" with provider/id/type filled in.
func Verify(headers http.Header, body []byte, secret string, store *Store) models.VerifyResult {
	if secret == "" {
		return models.VerifyResult{
			Status: "unverified",
			Error:  "no signing secret configured — set it to verify webhooks",
		}
	}

	prov, err := svix.New(secret)
	if err != nil {
		return models.VerifyResult{
			Status: "unverified",
			Error:  "invalid signing secret: " + err.Error(),
		}
	}

	if err := prov.VerifySignature(headers, body); err != nil {
		return models.VerifyResult{
			Status: "unverified",
			Error:  err.Error(),
		}
	}

	// Signature is valid; derive the dedupe key from the verified svix-id.
	id, err := prov.HeaderDedupKey(headers)
	if err != nil {
		return models.VerifyResult{
			Status: "unverified",
			Error:  err.Error(),
		}
	}

	res := models.VerifyResult{
		Status:          "verified",
		Provider:        svix.ProviderName,
		ProviderEventID: id,
	}

	// Dedupe goes through onceo-core's Store contract (SaveIfNew): when the
	// svix-id has already been recorded, SaveIfNew returns created=false and
	// we surface the event as a duplicate.
	created, derr := (&storeDeduper{store: store}).SaveIfNew(context.Background(), onceo.Event{
		Provider:        svix.ProviderName,
		ProviderEventID: id,
	})
	if derr != nil {
		res.Status = "unverified"
		res.Error = derr.Error()
		return res
	}
	if !created {
		res.Status = "duplicate"
		return res
	}

	// Best-effort event type extraction from the payload envelope.
	parsed, perr := prov.Parse(body)
	if perr == nil {
		if norm, nerr := prov.Normalize(parsed); nerr == nil && norm.Type != "" {
			res.EventType = norm.Type
		}
	}
	return res
}

// storeDeduper adapts our durable Store to onceo-core's Store interface,
// providing exactly-once SaveIfNew semantics keyed on provider + event id.
type storeDeduper struct {
	store *Store
}

func (d *storeDeduper) SaveIfNew(ctx context.Context, e onceo.Event) (bool, error) {
	if e.Provider == "" || e.ProviderEventID == "" {
		return false, onceo.ErrStoreFailed
	}
	if d.store.IsKnown(e.Provider, e.ProviderEventID) {
		return false, nil
	}
	d.store.mu.Lock()
	defer d.store.mu.Unlock()
	if err := d.store.load(); err != nil {
		return false, err
	}
	if d.store.verified[dedupeKey(e.Provider, e.ProviderEventID)] {
		return false, nil
	}
	d.store.verified[dedupeKey(e.Provider, e.ProviderEventID)] = true
	return true, nil
}

var _ onceo.Store = (*storeDeduper)(nil)
