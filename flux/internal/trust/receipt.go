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
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

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

// lock takes the cross-process write lock for this store.
func (s *Store) lock() (func(), error) {
	release, err := lockPath(filepath.Join(s.dir, ".lock"))
	if err != nil {
		return nil, fmt.Errorf("trust: lock receipt store: %w", err)
	}
	return release, nil
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

// Write stores a receipt, linking it to the newest one already on disk.
func (s *Store) Write(r *Receipt) error {
	if s == nil || r == nil {
		return errors.New("trust: nil store or receipt")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return fmt.Errorf("trust: create runs dir: %w", err)
	}
	// The app, CLI and MCP server are separate processes that can share a
	// workspace. The mutex covers this process; the lock file covers the rest,
	// so two writers cannot both link to the same predecessor and fork the
	// chain.
	release, err := s.lock()
	if err != nil {
		return err
	}
	defer release()

	if r.Version == 0 {
		r.Version = ReceiptVersion
	}
	if r.Kind == "" {
		r.Kind = "run"
	}
	if r.ID == "" {
		r.ID = newID()
	}
	if r.Time == "" {
		r.Time = time.Now().UTC().Format(time.RFC3339Nano)
	}

	// Link to the newest receipt. A missing or unreadable predecessor is not
	// fatal: the receipt is still useful on its own.
	if r.PrevHash == "" {
		if prev := s.latestLocked(); prev != nil {
			r.PrevHash = prev.Hash
		}
	}

	r.Hash = ""
	hash, err := r.computeHash()
	if err != nil {
		return err
	}
	r.Hash = hash
	s.applySignature(r)

	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("trust: marshal receipt: %w", err)
	}
	data = append(data, '\n')
	return atomicWrite(filepath.Join(s.dir, r.ID+".json"), data)
}

// Annotate rewrites a receipt, for example to attach contract validation that
// only runs after the request completes. The hash is recomputed, and any
// receipts that were written in the meantime are re-linked so the chain stays
// continuous.
func (s *Store) Annotate(id string, fn func(*Receipt)) error {
	if s == nil || id == "" || fn == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return fmt.Errorf("trust: create runs dir: %w", err)
	}
	release, err := s.lock()
	if err != nil {
		return err
	}
	defer release()

	r, err := s.getLocked(id)
	if err != nil {
		return err
	}
	oldHash := r.Hash
	fn(r)
	r.Hash = ""
	hash, err := r.computeHash()
	if err != nil {
		return err
	}
	r.Hash = hash
	s.applySignature(r)
	if err := s.writeLocked(r); err != nil {
		return err
	}
	if hash != oldHash {
		return s.relinkAfterLocked(r.ID)
	}
	return nil
}

// writeLocked persists a receipt that already has its hash and signature.
func (s *Store) writeLocked(r *Receipt) error {
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return fmt.Errorf("trust: marshal receipt: %w", err)
	}
	data = append(data, '\n')
	return atomicWrite(filepath.Join(s.dir, r.ID+".json"), data)
}

// relinkAfterLocked repairs the chain after a receipt's hash changed. Each
// later receipt pointed at the old hash, so it is rewritten with the new
// predecessor hash and a hash of its own content. Earlier receipts are left
// untouched: a mismatch there is tamper evidence, not something to repair.
func (s *Store) relinkAfterLocked(id string) error {
	all, err := s.listAscendingLocked()
	if err != nil {
		return err
	}
	idx := -1
	for i := range all {
		if all[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return nil
	}
	prev := all[idx].Hash
	for i := idx + 1; i < len(all); i++ {
		r := &all[i]
		if r.PrevHash == prev {
			prev = r.Hash
			continue
		}
		r.PrevHash = prev
		r.Hash = ""
		hash, err := r.computeHash()
		if err != nil {
			return err
		}
		r.Hash = hash
		s.applySignature(r)
		if err := s.writeLocked(r); err != nil {
			return err
		}
		prev = hash
	}
	return nil
}

// listAscendingLocked returns every receipt oldest first.
func (s *Store) listAscendingLocked() ([]Receipt, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	out := make([]Receipt, 0, len(names))
	for _, name := range names {
		data, err := os.ReadFile(filepath.Join(s.dir, name))
		if err != nil {
			continue
		}
		var r Receipt
		if json.Unmarshal(data, &r) == nil && r.ID != "" {
			out = append(out, r)
		}
	}
	return out, nil
}

// VerifyReport describes what verification found.
type VerifyReport struct {
	Checked  int // receipts read
	Signed   int // receipts whose signature was verified
	Unsigned int // receipts written without a signing key
}

// VerifyChain checks that every receipt still hashes to its recorded value,
// that each PrevHash names the receipt before it, and that signed receipts
// carry a valid signature. It returns the number of receipts checked. A
// mismatch means a receipt was edited or removed after it was written.
func (s *Store) VerifyChain() (int, error) {
	report, err := s.VerifyChainReport()
	return report.Checked, err
}

// VerifyChainReport is VerifyChain with a breakdown of signed and unsigned
// receipts. Unsigned receipts are not an error: a machine without a signing
// key can still use receipts, it just cannot prove they were not rewritten.
func (s *Store) VerifyChainReport() (VerifyReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var report VerifyReport
	all, err := s.listAscendingLocked()
	if err != nil {
		return report, err
	}
	var prev string
	for i := range all {
		r := &all[i]
		if r.PrevHash != prev {
			return report, fmt.Errorf("trust: receipt %s does not link to its predecessor (want %q, got %q)", r.ID, prev, r.PrevHash)
		}
		got := r.Hash
		r.Hash = ""
		want, err := r.computeHash()
		r.Hash = got
		if err != nil {
			return report, err
		}
		if got != want {
			return report, fmt.Errorf("trust: receipt %s has been modified (want %q, got %q)", r.ID, want, got)
		}
		signed, err := s.verifySignature(r)
		if err != nil {
			return report, fmt.Errorf("trust: %w", err)
		}
		report.Checked++
		if signed {
			report.Signed++
		} else {
			report.Unsigned++
		}
		prev = got
	}
	return report, nil
}

// List returns receipts newest first, up to limit (0 means no limit).
func (s *Store) List(limit int) ([]Receipt, error) {
	if s == nil {
		return nil, nil
	}
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			names = append(names, e.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(names)))

	out := make([]Receipt, 0, len(names))
	for _, name := range names {
		data, err := os.ReadFile(filepath.Join(s.dir, name))
		if err != nil {
			continue
		}
		var r Receipt
		if json.Unmarshal(data, &r) == nil && (r.Kind == "run" || r.Kind == "loadtest") {
			out = append(out, r)
		}
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out, nil
}

// Get returns one receipt by full id or unambiguous prefix.
func (s *Store) Get(id string) (*Receipt, error) {
	if s == nil {
		return nil, errors.New("trust: no receipt store")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.getLocked(id)
}

func (s *Store) getLocked(id string) (*Receipt, error) {
	path := filepath.Join(s.dir, id+".json")
	if data, err := os.ReadFile(path); err == nil {
		var r Receipt
		if err := json.Unmarshal(data, &r); err != nil {
			return nil, err
		}
		return &r, nil
	}

	// Allow a prefix, which is what a human types from `runs list`.
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("trust: no receipt %q", id)
		}
		return nil, err
	}
	var matches []string
	for _, e := range entries {
		name := strings.TrimSuffix(e.Name(), ".json")
		if strings.HasPrefix(name, id) {
			matches = append(matches, name)
		}
	}
	switch len(matches) {
	case 0:
		return nil, fmt.Errorf("trust: no receipt %q", id)
	case 1:
		return s.getLocked(matches[0])
	default:
		return nil, fmt.Errorf("trust: receipt id %q is ambiguous (%d matches)", id, len(matches))
	}
}

func (s *Store) latestLocked() *Receipt {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil
	}
	var newest string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".json") {
			continue
		}
		if name > newest {
			newest = name
		}
	}
	if newest == "" {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(s.dir, newest))
	if err != nil {
		return nil
	}
	var r Receipt
	if json.Unmarshal(data, &r) != nil {
		return nil
	}
	return &r
}

// computeHash hashes the receipt with its Hash field empty.
func (r *Receipt) computeHash() (string, error) {
	clone := *r
	clone.Hash = ""
	clone.Signature = ""
	clone.KeyID = ""
	data, err := json.Marshal(clone)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}

func newID() string {
	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		// A clock-derived id is still unique enough; randomness only stops
		// two writes in the same nanosecond colliding.
		return time.Now().UTC().Format("20060102T150405.000000000Z")
	}
	return time.Now().UTC().Format("20060102T150405.000000000Z") + "-" + hex.EncodeToString(b[:])
}

func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".receipt-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
