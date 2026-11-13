// Package trust is the boundary every API call passes through.
//
// The requester package knows how to put bytes on the wire. This package knows
// what happened, in a form that can be written down without leaking a secret.
// Every surface — the desktop app, the CLI, the runner, the scheduler, the MCP
// server — executes through Execute so a run leaves a receipt.
//
// A receipt is not a log. It is a small, versioned, hash-chained record of one
// request: what was asked for, how it was resolved, what came back, and whether
// it matched. It stores hashes where a value could be a credential, so a receipt
// can be committed, shared or attached to a bug report without redaction work.
package trust

import (
	"path/filepath"
	"sync"

	"flux/internal/models"
)

// ReceiptVersion is bumped when the on-disk shape changes incompatibly.
const ReceiptVersion = 1

// Receipt is the record of one execution.
type Receipt struct {
	Version int    `json:"version"`
	ID      string `json:"id"`
	// Kind is "run" for a real execution. It exists so fixtures written later
	// (replay expectations) can share the directory without being mistaken
	// for runs.
	Kind        string `json:"kind"`
	Time        string `json:"time"`
	Source      string `json:"source"`
	Session     string `json:"session,omitempty"`
	Environment string `json:"environment,omitempty"`
	Workspace   string `json:"workspace,omitempty"`

	Request    RequestRecord            `json:"request"`
	Resolution []Resolution             `json:"resolution,omitempty"`
	Response   ResponseRecord           `json:"response"`
	Timing     *models.TimingBreakdown  `json:"timing,omitempty"`
	Validation *models.ValidationResult `json:"validation,omitempty"`

	// PrevHash points at the receipt written immediately before this one, and
	// Hash covers this receipt with Hash and Signature left empty. Together
	// they detect silent edits. Signature, when present, is an HMAC over Hash
	// keyed from the OS keychain, so an attacker with write access cannot
	// rewrite the chain and recompute a valid signature without the key.
	PrevHash  string `json:"prevHash,omitempty"`
	Hash      string `json:"hash,omitempty"`
	KeyID     string `json:"keyId,omitempty"`
	Signature string `json:"signature,omitempty"`

	// LoadTest is set on the single summary receipt a load test writes
	// instead of one receipt per request.
	LoadTest *LoadTestRecord `json:"loadTest,omitempty"`
}

// LoadTestRecord summarizes a load test. It exists so a test with thousands of
// requests still leaves one reviewable receipt.
type LoadTestRecord struct {
	VUs         int     `json:"vus"`
	DurationSec int     `json:"durationSec,omitempty"`
	Iterations  int     `json:"iterations,omitempty"`
	TotalReqs   int     `json:"totalReqs"`
	Passed      int     `json:"passed"`
	Failed      int     `json:"failed"`
	AvgMs       float64 `json:"avgMs"`
	P50Ms       float64 `json:"p50Ms"`
	P95Ms       float64 `json:"p95Ms"`
	P99Ms       float64 `json:"p99Ms"`
	DurationMs  int64   `json:"durationMs"`
	Error       string  `json:"error,omitempty"`
}

// RequestRecord is the request as it should be remembered. URLs and header
// names are kept; values that could be credentials are not.
type RequestRecord struct {
	Method      string         `json:"method"`
	URL         string         `json:"url"`
	Headers     []HeaderRecord `json:"headers,omitempty"`
	Params      []HeaderRecord `json:"params,omitempty"`
	BodyType    string         `json:"bodyType,omitempty"`
	BodySHA256  string         `json:"bodySha256,omitempty"`
	BodyBytes   int            `json:"bodyBytes,omitempty"`
	BodyPreview string         `json:"bodyPreview,omitempty"`
	AuthType    string         `json:"authType,omitempty"`
}

// HeaderRecord keeps the name of a header always, and its value only when the
// header is on the safe list.
type HeaderRecord struct {
	Name     string `json:"name"`
	Value    string `json:"value,omitempty"`
	Redacted bool   `json:"redacted,omitempty"`
}

// Resolution names a variable the request used and where it came from. The
// value is deliberately absent.
type Resolution struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

// ResponseRecord is the response with bodies reduced to a hash and a size.
type ResponseRecord struct {
	Status       string            `json:"status,omitempty"`
	StatusCode   int               `json:"statusCode"`
	Headers      map[string]string `json:"headers,omitempty"`
	BodySHA256   string            `json:"bodySha256,omitempty"`
	BodyBytes    int64             `json:"bodyBytes,omitempty"`
	BodyIsBase64 bool              `json:"bodyIsBase64,omitempty"`
	BodyPreview  string            `json:"bodyPreview,omitempty"`
	Cookies      int               `json:"cookies,omitempty"`
	Error        string            `json:"error,omitempty"`
}

// Store is a directory of receipts for one workspace.
type Store struct {
	dir string
	mu  sync.Mutex

	// signKey is resolved lazily; nil means unsigned. A non-nil empty slice is
	// never valid. signResolved keeps a failed lookup from retrying per write.
	signKey      []byte
	signResolved bool
}

// NewStore returns a receipt store rooted at workspaceDir/.reqit/runs.
func NewStore(workspaceDir string) *Store {
	return &Store{dir: filepath.Join(workspaceDir, ".reqit", "runs")}
}

// SetSigningKey sets the HMAC key used to sign receipts. It is primarily for
// tests and for callers that manage their own key; the default loads a key
// from the OS keychain on first use.
func (s *Store) SetSigningKey(key []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.signKey = key
	s.signResolved = true
}

// Dir is the directory receipts are written to.
func (s *Store) Dir() string {
	if s == nil {
		return ""
	}
	return s.dir
}

var (
	defaultStoreMu sync.RWMutex
	defaultStore   *Store
)

// SetDefaultStore configures the store used by callers that do not pass one.
// The desktop app sets it when a workspace is mounted; the CLI sets it from
// the active workspace. A nil store disables recording.
func SetDefaultStore(s *Store) {
	defaultStoreMu.Lock()
	defaultStore = s
	defaultStoreMu.Unlock()
}

// DefaultStore returns the process-wide store, if one was configured.
func DefaultStore() *Store {
	defaultStoreMu.RLock()
	defer defaultStoreMu.RUnlock()
	return defaultStore
}
