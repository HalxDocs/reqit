package profile

import (
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"flux/internal/storage"
)

const devProfileFile = "devprofile.json"

var usernameRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9\-]{0,30}[a-z0-9])?$`)

type DevProfile struct {
	Username       string       `json:"username"`
	DisplayName    string       `json:"displayName"`
	Bio            string       `json:"bio"`
	AvatarURL      string       `json:"avatarUrl,omitempty"`
	Links          []Link       `json:"links,omitempty"`
	Location       string       `json:"location,omitempty"`
	Company        string       `json:"company,omitempty"`
	Badges         []Badge      `json:"badges,omitempty"`
	Stats          DevStats     `json:"stats"`
	Skills         []string     `json:"skills,omitempty"`
	SocialLinks    []SocialLink `json:"socialLinks,omitempty"`
	GitHubUsername  string       `json:"githubUsername,omitempty"`
	Public         bool         `json:"public"`
	UpdatedAt      string       `json:"updatedAt"`
}

type Link struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type SocialLink struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type Badge struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	EarnedAt    string `json:"earnedAt"`
}

type DevStats struct {
	CollectionsCreated int      `json:"collectionsCreated"`
	RequestsSent       int      `json:"requestsSent"`
	AssertionsWritten  int      `json:"assertionsWritten"`
	SpecsAuthored      int      `json:"specsAuthored"`
	MockServersCreated int      `json:"mockServersCreated"`
	ContractPassRate   int      `json:"contractPassRate"`
	ProtocolsUsed      []string `json:"protocolsUsed"`
	AuthTypesUsed      []string `json:"authTypesUsed"`
}

type PublicProfile struct {
	Username       string       `json:"username"`
	DisplayName    string       `json:"displayName"`
	Bio            string       `json:"bio"`
	AvatarURL      string       `json:"avatarUrl,omitempty"`
	Links          []Link       `json:"links,omitempty"`
	Location       string       `json:"location,omitempty"`
	Company        string       `json:"company,omitempty"`
	Badges         []Badge      `json:"badges,omitempty"`
	Stats          DevStats     `json:"stats"`
	Projects       []ProjectRef `json:"projects,omitempty"`
	Skills         []string     `json:"skills,omitempty"`
	SocialLinks    []SocialLink `json:"socialLinks,omitempty"`
	GitHubUsername  string       `json:"githubUsername,omitempty"`
	UpdatedAt      string       `json:"updatedAt"`
}

type ProjectRef struct {
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	RequestCount int      `json:"requestCount"`
	TestCount    int      `json:"testCount"`
	Protocols    []string `json:"protocols,omitempty"`
	HasSpec      bool     `json:"hasSpec"`
	Public       bool     `json:"public"`
}

type DevProfileStore struct {
	mu      sync.Mutex
	dir     string
	profile *DevProfile
	loaded  bool
}

func NewDevProfileStore(dir string) *DevProfileStore {
	return &DevProfileStore{dir: dir}
}

func (s *DevProfileStore) load() error {
	if s.loaded {
		return nil
	}
	p := DevProfile{}
	if err := storage.LoadFrom(s.dir, devProfileFile, &p); err != nil {
		s.profile = &DevProfile{}
		s.loaded = true
		return nil
	}
	s.profile = &p
	s.loaded = true
	return nil
}

func (s *DevProfileStore) save() error {
	return storage.SaveTo(s.dir, devProfileFile, s.profile)
}

func (s *DevProfileStore) Get() (*DevProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	return s.profile, nil
}

func (s *DevProfileStore) Update(p DevProfile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}

	if p.Username != "" {
		s.profile.Username = strings.ToLower(strings.TrimSpace(p.Username))
	}
	if p.DisplayName != "" {
		s.profile.DisplayName = p.DisplayName
	}
	s.profile.Bio = p.Bio
	s.profile.AvatarURL = p.AvatarURL
	s.profile.Links = p.Links
	s.profile.Location = p.Location
	s.profile.Company = p.Company
	s.profile.Skills = p.Skills
	s.profile.SocialLinks = p.SocialLinks
	s.profile.GitHubUsername = p.GitHubUsername
	s.profile.Public = p.Public
	s.profile.UpdatedAt = time.Now().Format(time.RFC3339)

	return s.save()
}

func (s *DevProfileStore) UpdateStats(stats DevStats) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	s.profile.Stats = stats
	s.profile.UpdatedAt = time.Now().Format(time.RFC3339)
	return s.save()
}

func (s *DevProfileStore) SetPublic(public bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	s.profile.Public = public
	s.profile.UpdatedAt = time.Now().Format(time.RFC3339)
	return s.save()
}

func (s *DevProfileStore) GetPublicProfile() (*PublicProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	if s.profile.Username == "" {
		return nil, errors.New("username not set — go to Settings > Profile to set your username")
	}
	return &PublicProfile{
		Username:      s.profile.Username,
		DisplayName:   s.profile.DisplayName,
		Bio:           s.profile.Bio,
		AvatarURL:     s.profile.AvatarURL,
		Links:         s.profile.Links,
		Location:      s.profile.Location,
		Company:       s.profile.Company,
		Badges:        s.profile.Badges,
		Stats:         s.profile.Stats,
		Skills:        s.profile.Skills,
		SocialLinks:   s.profile.SocialLinks,
		GitHubUsername: s.profile.GitHubUsername,
		UpdatedAt:     s.profile.UpdatedAt,
	}, nil
}

func ValidateDevUsername(u string) bool {
	return usernameRe.MatchString(u)
}
