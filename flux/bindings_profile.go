package main

import (
	"errors"
	"flux/internal/profile"
	"flux/internal/storage"
	"fmt"
	"strings"
)

func (a *App) GetProfile() (profile.Profile, error) {
	return a.profile.Get()
}

func (a *App) UpdateProfile(name, email string) error {
	return a.profile.Update(name, email)
}

func (a *App) AppDataDir() (string, error) {
	return storage.AppDir()
}

// --- Interceptor (Browser Traffic Capture) ---

type InterceptorStatus struct {
	Running bool `json:"running"`
	Port    int  `json:"port"`
	Count   int  `json:"count"`
}

func (a *App) GetDevProfile() (*profile.DevProfile, error) {
	if a.devProfile == nil {
		return nil, errors.New("no active workspace")
	}
	return a.devProfile.Get()
}

func (a *App) SaveDevProfile(p profile.DevProfile) error {
	if a.devProfile == nil {
		return errors.New("no active workspace")
	}
	return a.devProfile.Update(p)
}

func (a *App) SetDevProfilePublic(public bool) error {
	if a.devProfile == nil {
		return errors.New("no active workspace")
	}
	return a.devProfile.SetPublic(public)
}

func (a *App) GetPublicProfile() (*profile.PublicProfile, error) {
	if a.devProfile == nil {
		return nil, errors.New("no active workspace")
	}
	return a.devProfile.GetPublicProfile()
}

// PublishDevProfile stores the profile in Upstash Redis for instant web access.
func (a *App) PublishDevProfile() (string, error) {
	if a.devProfile == nil {
		return "", errors.New("no active workspace")
	}
	// Compute fresh stats before publishing so the live profile shows real data
	stats := a.ComputeDevStats()
	_ = a.devProfile.UpdateStats(stats)

	// Build projects from collections
	if a.collections != nil {
		colls, _ := a.collections.GetAll()
		var projects []profile.ProjectRef
		for _, c := range colls {
			proj := profile.ProjectRef{
				Name:         c.Name,
				Description:  c.Description,
				RequestCount: len(c.Requests),
				Protocols:    []string{},
				HasSpec:      c.SpecPath != "",
				Public:       true,
			}
			if c.Description == "" {
				proj.Description = fmt.Sprintf("%d requests", len(c.Requests))
			}
			protocols := map[string]bool{}
			for _, r := range c.Requests {
				if r.Payload.Method != "" {
					protocols[strings.ToUpper(r.Payload.Method)] = true
				}
			}
			for p := range protocols {
				proj.Protocols = append(proj.Protocols, p)
			}
			projects = append(projects, proj)
		}
		_ = a.devProfile.UpdateProjects(projects)
	}

	pub, err := a.devProfile.GetPublicProfile()
	if err != nil {
		return "", err
	}
	if err := profile.PublishToUpstash(pub); err != nil {
		return "", fmt.Errorf("publish profile: %w", err)
	}
	return fmt.Sprintf("https://reqit.dev/%s", pub.Username), nil
}

// SaveUpstashConfig stores the Upstash API credentials locally.
func (a *App) SaveUpstashConfig(url, token string) error {
	return profile.SaveUpstashConfig(url, token)
}

// IsUpstashConfigured returns whether Upstash credentials are set.
func (a *App) IsUpstashConfigured() bool {
	return profile.IsUpstashConfigured()
}

func (a *App) ComputeDevStats() profile.DevStats {
	if a.collections == nil {
		return profile.DevStats{}
	}

	colls, _ := a.collections.GetAll()
	protos := map[string]bool{}
	auths := map[string]bool{}
	totalReqs := 0
	specsCount := 0
	passCount := 0
	totalValidated := 0
	assertionCount := 0

	for _, c := range colls {
		if c.SpecPath != "" {
			specsCount++
		}
		for _, r := range c.Requests {
			totalReqs++
			if r.Payload.Method != "" {
				protos[strings.ToUpper(r.Payload.Method)] = true
			}
			if r.Payload.AuthType != "" && r.Payload.AuthType != "none" {
				auths[r.Payload.AuthType] = true
			}
			if r.Payload.BodyType != "" {
				protos[r.Payload.BodyType] = true
			}
		}
	}

	// Count assertions from test suites
	if a.testSuites != nil {
		suites := a.testSuites.GetAll()
		for _, s := range suites {
			for _, g := range s.Groups {
				assertionCount += len(g.Assertions)
				for _, child := range g.Children {
					assertionCount += len(child.Assertions)
				}
			}
		}
	}

	// Contract pass rate from history
	if a.history != nil {
		entries, _ := a.history.GetAll()
		for _, e := range entries {
			if e.Response.Validation != nil {
				totalValidated++
				if e.Response.Validation.Valid {
					passCount++
				}
			}
		}
	}

	passRate := 0
	if totalValidated > 0 {
		passRate = (passCount * 100) / totalValidated
	}

	protoList := make([]string, 0, len(protos))
	for p := range protos {
		protoList = append(protoList, p)
	}
	authList := make([]string, 0, len(auths))
	for a := range auths {
		authList = append(authList, a)
	}

	return profile.DevStats{
		CollectionsCreated: len(colls),
		RequestsSent:       totalReqs,
		AssertionsWritten:  assertionCount,
		SpecsAuthored:      specsCount,
		MockServersCreated: 0,
		ContractPassRate:   passRate,
		ProtocolsUsed:      protoList,
		AuthTypesUsed:      authList,
	}
}

// Agent Lens (moved to bindings_ai.go)
