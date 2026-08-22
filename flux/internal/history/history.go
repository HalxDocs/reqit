package history

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/oauth2"
	"flux/internal/storage"
)

const fileName = "history.json"
const Cap = 500

type wrapper struct {
	Entries []models.HistoryEntry `json:"entries"`
}

type Store struct {
	mu           sync.Mutex
	dir          string
	workspaceKey string // stable workspace identity for keyring keys
	entries      []models.HistoryEntry
	loaded       bool
}

func NewStore(dir string) *Store {
	return &Store{dir: dir, workspaceKey: oauth2.WorkspaceKeyFromDir(dir)}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	w := wrapper{}
	if err := storage.LoadFrom(s.dir, fileName, &w); err != nil {
		return err
	}
	if w.Entries == nil {
		w.Entries = []models.HistoryEntry{}
	}
	s.entries = w.Entries
	// Move any legacy inline OAuth tokens into the OS keychain and rewrite the
	// history file without secrets.
	if s.migrateOAuthSecrets() {
		_ = s.save()
	}
	s.loaded = true
	return nil
}

// migrateOAuthSecrets moves legacy inline OAuth tokens out of history payloads
// into the OS keychain. Best-effort: if the keychain is unavailable the entry
// is left untouched so no token is lost. Returns true if anything changed.
// Caller must hold s.mu.
func (s *Store) migrateOAuthSecrets() bool {
	changed := false
	for i := range s.entries {
		p := &s.entries[i].Payload
		if p.AuthType != "oauth2" || p.AuthValue == "" {
			continue
		}
		clean, _, err := oauth2.MigrateAuthValue(p.AuthValue, s.workspaceKey)
		if err != nil {
			continue // keychain unavailable — preserve the token in place
		}
		if clean != p.AuthValue {
			p.AuthValue = clean
			changed = true
		}
	}
	return changed
}

// save persists history to disk, scrubbing any OAuth secrets from the serialized
// copy so the (git-tracked) history file never contains live tokens.
// Caller must hold s.mu.
func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Entries: s.scrubbedEntries()})
}

// scrubbedEntries returns a copy of entries whose OAuth2 payloads have been
// sanitized (tokens moved to the OS keychain, or stripped if the keychain is
// unavailable). The in-memory entries keep tokens for the current session.
func (s *Store) scrubbedEntries() []models.HistoryEntry {
	out := make([]models.HistoryEntry, len(s.entries))
	for i, e := range s.entries {
		out[i] = e
		if e.Payload.AuthType != "oauth2" || e.Payload.AuthValue == "" {
			continue
		}
		clean, _, err := oauth2.MigrateAuthValue(e.Payload.AuthValue, s.workspaceKey)
		if err != nil {
			// Keychain unavailable — still never write secrets to the history
			// file; raw-token forms are cleared entirely.
			out[i].Payload.AuthValue = oauth2.SanitizeAuthValueForExport(e.Payload.AuthValue)
			continue
		}
		out[i].Payload.AuthValue = clean
	}
	return out
}

func (s *Store) Append(payload models.RequestPayload, response models.ResponseResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	entry := models.HistoryEntry{
		ID:        uuid.NewString(),
		Payload:   payload,
		Response:  response,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.entries = append([]models.HistoryEntry{entry}, s.entries...)
	if len(s.entries) > Cap {
		s.entries = s.entries[:Cap]
	}
	return s.save()
}

func (s *Store) GetAll() ([]models.HistoryEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]models.HistoryEntry, len(s.entries))
	copy(out, s.entries)
	return out, nil
}

func (s *Store) DeleteEntry(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	filtered := make([]models.HistoryEntry, 0, len(s.entries))
	for _, e := range s.entries {
		if e.ID != id {
			filtered = append(filtered, e)
		}
	}
	s.entries = filtered
	return s.save()
}

func (s *Store) UpdateEntry(id string, patch map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.entries {
		if s.entries[i].ID == id {
			if tags, ok := patch["tags"]; ok {
				if t, ok := tags.([]string); ok {
					s.entries[i].Tags = t
				}
			}
			if fav, ok := patch["favorite"]; ok {
				if f, ok := fav.(bool); ok {
					s.entries[i].Favorite = f
				}
			}
			break
		}
	}
	return s.save()
}

func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = []models.HistoryEntry{}
	s.loaded = true
	return s.save()
}

func (s *Store) Flush() {}
