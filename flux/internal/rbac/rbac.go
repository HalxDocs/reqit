package rbac

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Role defines a named set of permissions.
type Role string

const (
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

// Permission defines an action that can be performed on a resource.
type Permission string

const (
	PermRead   Permission = "read"
	PermWrite  Permission = "write"
	PermDelete Permission = "delete"
	PermShare  Permission = "share"
	PermExport Permission = "export"
	PermManage Permission = "manage"
)

// ResourceType defines the type of resource being protected.
type ResourceType string

const (
	ResCollection  ResourceType = "collection"
	ResEnvironment ResourceType = "environment"
	ResWorkspace   ResourceType = "workspace"
	ResSpec        ResourceType = "spec"
	ResMock        ResourceType = "mock"
	ResSettings    ResourceType = "settings"
)

// RolePermissions maps roles to their allowed permissions.
var RolePermissions = map[Role][]Permission{
	RoleAdmin:  {PermRead, PermWrite, PermDelete, PermShare, PermExport, PermManage},
	RoleEditor: {PermRead, PermWrite, PermExport},
	RoleViewer: {PermRead, PermExport},
}

// ACE is an access control entry: who can do what on which resource.
type ACE struct {
	UserID      string       `json:"userId"`
	ResourceID  string       `json:"resourceId"`
	ResourceType ResourceType `json:"resourceType"`
	Role        Role         `json:"role"`
	Permissions []Permission `json:"permissions,omitempty"` // custom overrides
}

// Store manages RBAC access control entries.
type Store struct {
	mu       sync.RWMutex
	dataDir  string
	entries  []ACE
}

// New creates an RBAC store.
func New(dataDir string) *Store {
	s := &Store{dataDir: dataDir}
	_ = s.load()
	// If empty, grant admin to all by default.
	if len(s.entries) == 0 {
		s.entries = append(s.entries, ACE{
			UserID:      "*",
			ResourceID:  "*",
			ResourceType: "*",
			Role:        RoleAdmin,
			Permissions: RolePermissions[RoleAdmin],
		})
		_ = s.save()
	}
	return s
}

func (s *Store) load() error {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "rbac", "acl.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.entries)
}

func (s *Store) save() error {
	dir := filepath.Join(s.dataDir, "rbac")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s.entries, "", "  ")
	return os.WriteFile(filepath.Join(dir, "acl.json"), data, 0600)
}

// Grant assigns a role to a user for a specific resource.
func (s *Store) Grant(userID, resourceID string, resourceType ResourceType, role Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	perms := make([]Permission, len(RolePermissions[role]))
	copy(perms, RolePermissions[role])
	s.entries = append(s.entries, ACE{
		UserID:       userID,
		ResourceID:   resourceID,
		ResourceType: resourceType,
		Role:         role,
		Permissions:  perms,
	})
	return s.save()
}

// Revoke removes all ACEs for a user + resource combination.
func (s *Store) Revoke(userID, resourceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var kept []ACE
	for _, ace := range s.entries {
		if ace.UserID == userID && ace.ResourceID == resourceID {
			continue
		}
		kept = append(kept, ace)
	}
	s.entries = kept
	return s.save()
}

// Check verifies that a user has the required permission on a resource.
func (s *Store) Check(userID, resourceID string, resourceType ResourceType, perm Permission) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, ace := range s.entries {
		if ace.UserID == "*" || ace.UserID == userID {
			if ace.ResourceID == "*" || ace.ResourceID == resourceID {
				if ace.ResourceType == "*" || ace.ResourceType == resourceType {
					for _, p := range ace.Permissions {
						if p == perm {
							return true
						}
					}
				}
			}
		}
	}
	return false
}

// List returns all ACEs for a given user or resource.
func (s *Store) List(userID, resourceID string) []ACE {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []ACE
	for _, ace := range s.entries {
		if userID != "" && ace.UserID != userID && ace.UserID != "*" {
			continue
		}
		if resourceID != "" && ace.ResourceID != resourceID && ace.ResourceID != "*" {
			continue
		}
		result = append(result, ace)
	}
	return result
}

// SetCustomPermissions overrides permissions for a specific ACE.
func (s *Store) SetCustomPermissions(userID, resourceID string, perms []Permission) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.entries {
		if s.entries[i].UserID == userID && s.entries[i].ResourceID == resourceID {
			s.entries[i].Permissions = perms
			return s.save()
		}
	}
	return fmt.Errorf("no ACE found for %s/%s", userID, resourceID)
}

// MarshalACEs serialises a slice of ACEs to JSON.
func MarshalACEs(entries []ACE) (string, error) {
	data, err := json.Marshal(entries)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
