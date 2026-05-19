package cookies

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type stored struct {
	Name     string    `json:"name"`
	Value    string    `json:"value"`
	Expires  time.Time `json:"expires,omitempty"`
	Path     string    `json:"path"`
	HttpOnly bool      `json:"httpOnly"`
	Secure   bool      `json:"secure"`
}

// Store is a persistent, workspace-scoped cookie jar.
// It implements http.CookieJar so the HTTP client uses it transparently.
type Store struct {
	mu   sync.Mutex
	data map[string][]stored // hostname → cookies
	file string
}

func New(workspaceDir string) *Store {
	s := &Store{
		data: make(map[string][]stored),
		file: filepath.Join(workspaceDir, ".reqit-cookies.json"),
	}
	_ = s.load()
	return s
}

// SetCookies merges incoming cookies for the URL's host and persists.
func (s *Store) SetCookies(u *url.URL, cookies []*http.Cookie) {
	s.mu.Lock()
	defer s.mu.Unlock()
	host := u.Hostname()
	existing := s.data[host]
	for _, c := range cookies {
		sc := stored{
			Name:     c.Name,
			Value:    c.Value,
			Expires:  c.Expires,
			Path:     c.Path,
			HttpOnly: c.HttpOnly,
			Secure:   c.Secure,
		}
		replaced := false
		for i, e := range existing {
			if e.Name == c.Name {
				existing[i] = sc
				replaced = true
				break
			}
		}
		if !replaced {
			existing = append(existing, sc)
		}
	}
	// Prune expired.
	now := time.Now()
	valid := existing[:0]
	for _, c := range existing {
		if c.Expires.IsZero() || c.Expires.After(now) {
			valid = append(valid, c)
		}
	}
	s.data[host] = valid
	_ = s.save()
}

// Cookies returns stored cookies for the URL's host, skipping expired ones.
func (s *Store) Cookies(u *url.URL) []*http.Cookie {
	s.mu.Lock()
	defer s.mu.Unlock()
	host := u.Hostname()
	now := time.Now()
	var out []*http.Cookie
	for _, c := range s.data[host] {
		if c.Expires.IsZero() || c.Expires.After(now) {
			out = append(out, &http.Cookie{Name: c.Name, Value: c.Value})
		}
	}
	return out
}

// CookieInfo is the frontend-safe view of a stored cookie.
type CookieInfo struct {
	Domain   string `json:"domain"`
	Name     string `json:"name"`
	Value    string `json:"value"`
	Expires  string `json:"expires"`
	HttpOnly bool   `json:"httpOnly"`
	Secure   bool   `json:"secure"`
}

// GetAll returns every stored cookie across all domains.
func (s *Store) GetAll() []CookieInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []CookieInfo
	for host, cookies := range s.data {
		for _, c := range cookies {
			exp := ""
			if !c.Expires.IsZero() {
				exp = c.Expires.Format(time.RFC3339)
			}
			out = append(out, CookieInfo{
				Domain: host, Name: c.Name, Value: c.Value,
				Expires: exp, HttpOnly: c.HttpOnly, Secure: c.Secure,
			})
		}
	}
	return out
}

// GetForDomain returns stored cookies for a specific hostname.
func (s *Store) GetForDomain(domain string) []CookieInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []CookieInfo
	for _, c := range s.data[domain] {
		exp := ""
		if !c.Expires.IsZero() {
			exp = c.Expires.Format(time.RFC3339)
		}
		out = append(out, CookieInfo{
			Domain: domain, Name: c.Name, Value: c.Value,
			Expires: exp, HttpOnly: c.HttpOnly, Secure: c.Secure,
		})
	}
	return out
}

// ClearDomain removes all cookies for a hostname.
func (s *Store) ClearDomain(domain string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, domain)
	_ = s.save()
}

// ClearAll wipes every stored cookie.
func (s *Store) ClearAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = make(map[string][]stored)
	_ = s.save()
}

func (s *Store) save() error {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file, b, 0600)
}

func (s *Store) load() error {
	b, err := os.ReadFile(s.file)
	if err != nil {
		return nil
	}
	return json.Unmarshal(b, &s.data)
}
