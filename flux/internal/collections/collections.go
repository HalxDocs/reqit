// Package collections owns persistence and CRUD for user-saved API collections.
// Collections are stored as individual JSON files (<dir>/collections/<id>.json)
// with a lightweight index.json for fast listing.  This replaces the old single
// collections.json format; migration happens automatically on first load.
package collections

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/oauth2"
	"flux/internal/storage"
)

type Store struct {
	mu            sync.RWMutex
	dir           string
	workspaceKey  string // stable workspace identity for keyring keys
	collections   []models.Collection
	loaded        bool
	requestIndex  map[string]*collReqRef // Fix 5: O(1) lookup by request ID
	dirty         map[int]bool           // Fix 7: collection indices with pending writes
	debounceTimer *time.Timer            // Fix 7: debounced save timer
	debounceCh    chan struct{}          // Fix 7: signals immediate flush
	stopCh        chan struct{}          // Fix 7: signals goroutine to stop
	wg            sync.WaitGroup         // Fix 7: wait for final flush on shutdown
}

// collReqRef holds positions within the collections slice for the request index.
type collReqRef struct {
	CollIdx int
	ReqIdx  int
}

func NewStore(dir string) *Store {
	s := &Store{
		dir:          dir,
		workspaceKey: oauth2.WorkspaceKeyFromDir(dir),
		requestIndex: make(map[string]*collReqRef),
		dirty:        make(map[int]bool),
		debounceCh:   make(chan struct{}, 1),
		stopCh:       make(chan struct{}),
	}
	s.startDebouncer()
	return s
}

// startDebouncer launches the background goroutine that flushes dirty
// collections to disk after a short quiet period or on explicit flush signal.
func (s *Store) startDebouncer() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		const debounceInterval = 200 * time.Millisecond
		for {
			select {
			case <-s.stopCh:
				s.flushDirty()
				return
			case <-s.debounceCh:
				// Immediate flush requested.
				s.flushDirty()
			case <-func() <-chan time.Time {
				s.mu.Lock()
				if s.debounceTimer != nil {
					t := s.debounceTimer.C
					s.mu.Unlock()
					return t
				}
				s.mu.Unlock()
				return nil
			}():
				s.flushDirty()
			}
		}
	}()
}

// flushDirty writes all dirty collections to disk.  Caller need NOT hold mu.
func (s *Store) flushDirty() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.dirty) == 0 {
		return
	}
	for idx := range s.dirty {
		if idx < 0 || idx >= len(s.collections) {
			continue
		}
		if err := s.saveLocked(idx); err != nil {
			// Log and continue; don't lose other dirty collections.
			fmt.Fprintf(os.Stderr, "collections: failed to save collection %d: %v\n", idx, err)
		}
	}
	s.dirty = make(map[int]bool)
}

// markDirty marks a collection index as needing a save (Fix 7: debounce).
// Caller must hold s.mu.
func (s *Store) markDirty(idx int) {
	s.dirty[idx] = true
	if s.debounceTimer != nil {
		s.debounceTimer.Stop()
	}
	s.debounceTimer = time.AfterFunc(200*time.Millisecond, func() {
		s.debounceCh <- struct{}{}
	})
}

// Flush forces all pending dirty collections to disk immediately.
// Called before app shutdown or when synchronous persistence is required.
func (s *Store) Flush() {
	s.debounceCh <- struct{}{}
	s.wg.Wait()
}

// Stop flushes pending writes and stops the background goroutine.
func (s *Store) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

// load reads the index, then lazy-loads individual collection files.
// It also handles migration from the legacy single-file format.
func (s *Store) load() error {
	if s.loaded {
		return nil
	}

	// Attempt migration from legacy collections.json on first load.
	migrated, mErr := storage.MigrateFromOldFormat(s.dir)
	if mErr != nil {
		return fmt.Errorf("migrate collections: %w", mErr)
	}
	if migrated {
		// Re-read; index.json now exists.
	}

	// storage.LoadFrom is used below — storage.IndexFile also available for path construction.
	var idx struct {
		Collections []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Order     int    `json:"order"`
			UpdatedAt string `json:"updatedAt"`
		} `json:"collections"`
	}
	if err := storage.LoadFrom(s.dir, filepath.Join("collections", "index.json"), &idx); err != nil {
		return err
	}
	if idx.Collections == nil {
		idx.Collections = []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Order     int    `json:"order"`
			UpdatedAt string `json:"updatedAt"`
		}{}
	}

	cols := make([]models.Collection, len(idx.Collections))
	for i, entry := range idx.Collections {
		cols[i] = models.Collection{
			ID:   entry.ID,
			Name: entry.Name,
		}
		// Lazy-load full content when first accessed.
		if err := s.loadCollectionFile(&cols[i]); err != nil {
			return err
		}
	}

	s.collections = cols
	s.rebuildRequestIndex()
	// Move any legacy inline OAuth tokens into the OS keychain and schedule a
	// rewrite of the (git-tracked) collection files without secrets.
	s.migrateOAuthSecrets()
	s.loaded = true
	return nil
}

// loadOnce performs the (potentially mutating) load under a write lock, then
// releases it. Read paths use this so the migration pass never races readers.
func (s *Store) loadOnce() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load()
}

// migrateOAuthSecrets moves any legacy inline OAuth tokens found in stored
// request payloads into the OS keychain and rewrites the collection file
// without secrets immediately, so git-tracked files are scrubbed on first
// load. Best-effort: if the keychain is unavailable the payload is left
// untouched so no token is lost.
// Caller must hold s.mu (write lock).
func (s *Store) migrateOAuthSecrets() {
	for i := range s.collections {
		collChanged := false
		for j := range s.collections[i].Requests {
			p := &s.collections[i].Requests[j].Payload
			if p.AuthType != "oauth2" || p.AuthValue == "" {
				continue
			}
			clean, _, err := oauth2.MigrateAuthValue(p.AuthValue, s.workspaceKey)
			if err != nil {
				continue // keychain unavailable — preserve the token in place
			}
			if clean != p.AuthValue {
				p.AuthValue = clean
				collChanged = true
			}
		}
		if collChanged {
			// Synchronous write (still under the write lock) so the file is
			// scrubbed before any reader or git sync can observe the secret.
			if err := s.save(i); err != nil {
				fmt.Fprintf(os.Stderr, "collections: failed to rewrite scrubbed collection %d: %v\n", i, err)
			}
		}
	}
}

func (s *Store) loadCollectionFile(c *models.Collection) error {
	path := storage.CollectionFile(s.dir, c.ID)
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	return jsonUnmarshal(data, c)
}

// rebuildRequestIndex reconstructs the request ID lookup map (Fix 5).
func (s *Store) rebuildRequestIndex() {
	s.requestIndex = make(map[string]*collReqRef)
	for ci := range s.collections {
		for ri := range s.collections[ci].Requests {
			reqID := s.collections[ci].Requests[ri].ID
			s.requestIndex[reqID] = &collReqRef{CollIdx: ci, ReqIdx: ri}
		}
	}
}

// saveLocked persists a single collection to its file and updates index.json.
// Caller must hold s.mu (at least write-lock). Secrets are scrubbed from the
// serialized copy so nothing sensitive is ever written to the git-tracked
// collection file.
func (s *Store) saveLocked(collIdx int) error {
	c := s.scrubbedForDisk(s.collections[collIdx])
	collDir := storage.CollectionDir(s.dir)
	if err := os.MkdirAll(collDir, 0o755); err != nil {
		return err
	}
	cf := storage.CollectionFile(s.dir, c.ID)
	data, err := jsonMarshalIndent(c)
	if err != nil {
		return err
	}
	if err := os.WriteFile(cf+".tmp", data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(cf+".tmp", cf); err != nil {
		return err
	}
	return s.saveIndexLocked()
}

// scrubbedForDisk returns a copy of the collection whose OAuth2 payloads have
// been sanitized (tokens/client secrets moved to the OS keychain, or stripped)
// so the on-disk, git-tracked JSON never contains live secrets. The in-memory
// copy keeps tokens for the current session; disk and memory converge after a
// restart (load migration) — bindings rehydrate tokens for the renderer.
func (s *Store) scrubbedForDisk(c models.Collection) models.Collection {
	out := c
	out.Requests = make([]models.SavedRequest, len(c.Requests))
	for i, r := range c.Requests {
		out.Requests[i] = r
		out.Requests[i].Payload = s.scrubPayload(r.Payload)
	}
	return out
}

func (s *Store) scrubPayload(p models.RequestPayload) models.RequestPayload {
	if p.AuthType != "oauth2" || p.AuthValue == "" {
		return p
	}
	clean, _, err := oauth2.MigrateAuthValue(p.AuthValue, s.workspaceKey)
	if err != nil {
		// Keychain unavailable — still never write secrets to disk. Strip the
		// token from the file (raw-token forms are cleared entirely); it
		// remains in the renderer session and the user can re-authorize (or
		// fix their keyring).
		p.AuthValue = oauth2.SanitizeAuthValueForExport(p.AuthValue)
		return p
	}
	if clean != p.AuthValue {
		p.AuthValue = clean
	}
	return p
}

// save persists a single collection to disk immediately (synchronous,
// used during migration and for initial writes).  Caller must hold s.mu.
func (s *Store) save(collIdx int) error {
	if err := s.saveLocked(collIdx); err != nil {
		return err
	}
	// Don't keep it in the dirty set since it's already flushed.
	delete(s.dirty, collIdx)
	return nil
}

// saveIndexLocked writes the lightweight index.json.  Caller must hold s.mu.
func (s *Store) saveIndexLocked() error {
	type idxEntry struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Order     int    `json:"order"`
		UpdatedAt string `json:"updatedAt"`
	}
	idx := struct {
		Collections []idxEntry `json:"collections"`
	}{
		Collections: make([]idxEntry, len(s.collections)),
	}
	now := timeNow().UTC().Format(time3339)
	for i, c := range s.collections {
		idx.Collections[i] = idxEntry{
			ID:        c.ID,
			Name:      c.Name,
			Order:     i,
			UpdatedAt: now,
		}
	}
	idxFile := storage.IndexFile(s.dir)
	collDir := storage.CollectionDir(s.dir)
	if err := os.MkdirAll(collDir, 0o755); err != nil {
		return err
	}
	data, err := jsonMarshalIndent(idx)
	if err != nil {
		return err
	}
	if err := os.WriteFile(idxFile+".tmp", data, 0o644); err != nil {
		return err
	}
	return os.Rename(idxFile+".tmp", idxFile)
}

// --- exported helpers for collection-level mutations ---

// findColl returns the index of the collection with the given ID,
// or -1 if not found.
func (s *Store) findColl(id string) int {
	for i := range s.collections {
		if s.collections[i].ID == id {
			return i
		}
	}
	return -1
}

// mutateColl locks, loads, finds the collection, runs fn, saves, and unlocks.
// fn receives a pointer to the collection and the collection index.
func (s *Store) mutateColl(collID string, fn func(c *models.Collection, idx int) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	idx := s.findColl(collID)
	if idx == -1 {
		return errors.New("collection not found")
	}
	if err := fn(&s.collections[idx], idx); err != nil {
		return err
	}
	s.markDirty(idx)
	return nil
}

// mutateReq locks, loads, finds the request via index, runs fn, marks dirty, and unlocks.
// fn receives the request pointer, collection index, and request index.
func (s *Store) mutateReq(reqID string, fn func(r *models.SavedRequest, collIdx, reqIdx int) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	ref, ok := s.requestIndex[reqID]
	if !ok {
		return errors.New("request not found")
	}
	if ref.CollIdx < 0 || ref.CollIdx >= len(s.collections) {
		s.rebuildRequestIndex()
		ref, ok = s.requestIndex[reqID]
		if !ok {
			return errors.New("request not found")
		}
	}
	c := &s.collections[ref.CollIdx]
	if ref.ReqIdx < 0 || ref.ReqIdx >= len(c.Requests) {
		s.rebuildRequestIndex()
		ref, ok = s.requestIndex[reqID]
		if !ok {
			return errors.New("request not found")
		}
	}
	if err := fn(&c.Requests[ref.ReqIdx], ref.CollIdx, ref.ReqIdx); err != nil {
		return err
	}
	s.markDirty(ref.CollIdx)
	return nil
}

// -- exported API -----------------------------------------------------------

// GetRequestDetail returns the full SavedRequest for the given request ID,
// or nil if not found.
func (s *Store) GetRequestDetail(reqID string) (*models.SavedRequest, error) {
	if err := s.loadOnce(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	ref, ok := s.requestIndex[reqID]
	if !ok {
		return nil, errors.New("request not found")
	}
	if ref.CollIdx < 0 || ref.CollIdx >= len(s.collections) ||
		ref.ReqIdx < 0 || ref.ReqIdx >= len(s.collections[ref.CollIdx].Requests) {
		s.rebuildRequestIndex()
		ref, ok = s.requestIndex[reqID]
		if !ok {
			return nil, errors.New("request not found")
		}
	}
	r := s.collections[ref.CollIdx].Requests[ref.ReqIdx]
	return &r, nil
}

func (s *Store) GetAll() ([]models.Collection, error) {
	if err := s.loadOnce(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Collection, len(s.collections))
	copy(out, s.collections)
	return out, nil
}

// GetAllSummary returns only metadata per request (no request bodies or
// saved responses) for fast sidebar listing (Fix 9).
func (s *Store) GetAllSummary() ([]models.Collection, error) {
	if err := s.loadOnce(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Collection, len(s.collections))
	for i := range s.collections {
		out[i] = s.collections[i]
		out[i].Requests = make([]models.SavedRequest, len(s.collections[i].Requests))
		for j := range s.collections[i].Requests {
			r := s.collections[i].Requests[j]
			out[i].Requests[j] = models.SavedRequest{
				ID:     r.ID,
				Name:   r.Name,
				Notes:  r.Notes,
				CollID: r.CollID,
				// Payload summary: method + URL only, no body/auth/etc.
				Payload: models.RequestPayload{
					Method: r.Payload.Method,
					URL:    r.Payload.URL,
				},
				CreatedAt:    r.CreatedAt,
				PreSetVars:   r.PreSetVars,
				ExtractRules: r.ExtractRules,
			}
		}
	}
	return out, nil
}

func (s *Store) CreateCollection(name string) (models.Collection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.Collection{}, err
	}
	c := models.Collection{
		ID:       uuid.NewString(),
		Name:     name,
		Requests: []models.SavedRequest{},
	}
	s.collections = append(s.collections, c)
	idx := len(s.collections) - 1
	if err := s.save(idx); err != nil {
		s.collections = s.collections[:len(s.collections)-1]
		return models.Collection{}, err
	}
	return c, nil
}

func (s *Store) RenameCollection(id, name string) error {
	return s.mutateColl(id, func(c *models.Collection, idx int) error {
		c.Name = name
		return nil
	})
}

func (s *Store) DeleteCollection(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	idx := s.findColl(id)
	if idx == -1 {
		return errors.New("collection not found")
	}
	s.collections = append(s.collections[:idx], s.collections[idx+1:]...)
	s.rebuildRequestIndex()
	// Remove collection file from disk (best-effort; ignore error).
	os.Remove(storage.CollectionFile(s.dir, id))
	return s.saveIndexLocked()
}

func (s *Store) AddRequest(collID, name string, payload models.RequestPayload) (models.SavedRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.SavedRequest{}, err
	}
	idx := s.findColl(collID)
	if idx == -1 {
		return models.SavedRequest{}, errors.New("collection not found")
	}
	req := models.SavedRequest{
		ID:        uuid.NewString(),
		Name:      name,
		CollID:    collID,
		Payload:   payload,
		CreatedAt: timeNow().UTC().Format(time3339),
	}
	s.collections[idx].Requests = append(s.collections[idx].Requests, req)
	s.requestIndex[req.ID] = &collReqRef{CollIdx: idx, ReqIdx: len(s.collections[idx].Requests) - 1}
	if err := s.save(idx); err != nil {
		// Roll back index
		delete(s.requestIndex, req.ID)
		s.collections[idx].Requests = s.collections[idx].Requests[:len(s.collections[idx].Requests)-1]
		return models.SavedRequest{}, err
	}
	return req, nil
}

func (s *Store) UpdateRequest(reqID, name string, payload models.RequestPayload) error {
	return s.mutateReq(reqID, func(r *models.SavedRequest, _, _ int) error {
		r.Name = name
		r.Payload = payload
		return nil
	})
}

func (s *Store) UpdateRequestScripts(reqID string, preSetVars []models.PreSetVar, extractRules []models.ExtractRule) error {
	return s.mutateReq(reqID, func(r *models.SavedRequest, _, _ int) error {
		r.PreSetVars = preSetVars
		r.ExtractRules = extractRules
		return nil
	})
}

func (s *Store) DeleteRequest(reqID string) error {
	return s.mutateReq(reqID, func(r *models.SavedRequest, collIdx, reqIdx int) error {
		c := &s.collections[collIdx]
		c.Requests = append(c.Requests[:reqIdx], c.Requests[reqIdx+1:]...)
		delete(s.requestIndex, reqID)
		// Rebuild index for this collection to keep reqIdx values correct.
		s.rebuildRequestIndex()
		return nil
	})
}

func (s *Store) DeleteRequests(ids []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}
	changed := make(map[int]bool)
	for i := range s.collections {
		filtered := s.collections[i].Requests[:0]
		for _, req := range s.collections[i].Requests {
			if !idSet[req.ID] {
				filtered = append(filtered, req)
			} else {
				delete(s.requestIndex, req.ID)
			}
		}
		if len(filtered) != len(s.collections[i].Requests) {
			s.collections[i].Requests = filtered
			changed[i] = true
		}
	}
	s.rebuildRequestIndex()
	for idx := range changed {
		s.markDirty(idx)
	}
	return nil
}

func (s *Store) ReorderCollection(id string, newIndex int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	old := s.findColl(id)
	if old == -1 {
		return errors.New("collection not found")
	}
	if newIndex < 0 || newIndex >= len(s.collections) {
		return errors.New("new index out of range")
	}
	if old == newIndex {
		return nil
	}
	c := s.collections[old]
	s.collections = append(s.collections[:old], s.collections[old+1:]...)
	s.collections = append(s.collections[:newIndex], append([]models.Collection{c}, s.collections[newIndex:]...)...)
	s.rebuildRequestIndex()
	return s.saveIndexLocked()
}

func (s *Store) ReorderRequest(collID, reqID string, newIndex int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	ci := s.findColl(collID)
	if ci == -1 {
		return errors.New("collection not found")
	}
	old := -1
	for j := range s.collections[ci].Requests {
		if s.collections[ci].Requests[j].ID == reqID {
			old = j
			break
		}
	}
	if old == -1 {
		return errors.New("request not found")
	}
	if newIndex < 0 || newIndex >= len(s.collections[ci].Requests) {
		return errors.New("new index out of range")
	}
	if old == newIndex {
		return nil
	}
	req := s.collections[ci].Requests[old]
	s.collections[ci].Requests = append(s.collections[ci].Requests[:old], s.collections[ci].Requests[old+1:]...)
	s.collections[ci].Requests = append(s.collections[ci].Requests[:newIndex], append([]models.SavedRequest{req}, s.collections[ci].Requests[newIndex:]...)...)
	s.rebuildRequestIndex()
	s.markDirty(ci)
	return nil
}

func (s *Store) MoveRequest(reqID, targetCollID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	ref, ok := s.requestIndex[reqID]
	if !ok {
		return errors.New("request not found")
	}
	dstIdx := s.findColl(targetCollID)
	if dstIdx == -1 {
		return errors.New("target collection not found")
	}
	if ref.CollIdx == dstIdx {
		return nil
	}
	req := s.collections[ref.CollIdx].Requests[ref.ReqIdx]
	req.CollID = targetCollID
	s.collections[ref.CollIdx].Requests = append(s.collections[ref.CollIdx].Requests[:ref.ReqIdx], s.collections[ref.CollIdx].Requests[ref.ReqIdx+1:]...)
	s.collections[dstIdx].Requests = append(s.collections[dstIdx].Requests, req)
	s.rebuildRequestIndex()
	s.markDirty(ref.CollIdx)
	s.markDirty(dstIdx)
	return nil
}

func (s *Store) SetSpec(collID, specPath string) error {
	return s.mutateColl(collID, func(c *models.Collection, _ int) error {
		c.SpecPath = specPath
		return nil
	})
}

func (s *Store) SetSavedResponse(colID, reqID string, resp models.SavedResponse) error {
	return s.mutateReq(reqID, func(r *models.SavedRequest, _, _ int) error {
		r.SavedResponse = &resp
		return nil
	})
}

func (s *Store) SetCollectionScripts(collID, preScript, postScript string) error {
	return s.mutateColl(collID, func(c *models.Collection, _ int) error {
		c.PreScript = preScript
		c.PostScript = postScript
		return nil
	})
}

func (s *Store) SetCollectionVariables(collID string, vars []models.EnvVar) error {
	return s.mutateColl(collID, func(c *models.Collection, _ int) error {
		c.Variables = vars
		return nil
	})
}

func (s *Store) SetMockOverride(colID, reqID string, o models.MockOverride) error {
	return s.mutateReq(reqID, func(r *models.SavedRequest, _, _ int) error {
		r.MockOverride = &o
		return nil
	})
}

// --- JSON helpers (allows overriding in tests) ---

var jsonMarshalIndent = func(v any) ([]byte, error) {
	return json.MarshalIndent(v, "", "  ")
}

var jsonUnmarshal = func(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

var timeNow = time.Now

var time3339 = time.RFC3339
