package hoppscotch

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
)

type hoppExport struct {
	V int            `json:"v"`
	Collections []hoppCollection `json:"collections"`
}

type hoppCollection struct {
	ID     string      `json:"id"`
	Name   string      `json:"name"`
	Folder []hoppFolder `json:"folder"`
	Request []hoppRequest `json:"request"`
}

type hoppFolder struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Folder []hoppFolder `json:"folder"`
}

type hoppRequest struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Method    string        `json:"method"`
	Endpoint  string        `json:"endpoint"`
	Params    []hoppParam   `json:"params"`
	Headers   []hoppHeader  `json:"headers"`
	Body      string        `json:"body"`
	BodyType  string        `json:"bodyType"`
	Auth      *hoppAuth     `json:"auth"`
	FolderID  string        `json:"folderId"`
}

type hoppParam struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Active bool   `json:"active"`
}

type hoppHeader struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Active bool   `json:"active"`
}

type hoppAuth struct {
	Type     string `json:"type"`
	Bearer   string `json:"bearerToken"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// Import parses a Hoppscotch export JSON and returns requests.
func Import(data []byte, collID string) ([]models.SavedRequest, error) {
	if len(data) == 0 {
		return nil, errors.New("empty file")
	}
	var exp hoppExport
	if err := json.Unmarshal(data, &exp); err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	var out []models.SavedRequest
	for _, col := range exp.Collections {
		folderMap := map[string]string{}
		buildFolderMap(col.Folder, "", folderMap)
		for _, req := range col.Request {
			sr := hoppToRequest(&req, collID, folderMap, now)
			out = append(out, sr)
		}
	}
	return out, nil
}

func buildFolderMap(folders []hoppFolder, prefix string, m map[string]string) {
	for _, f := range folders {
		name := f.Name
		if prefix != "" {
			name = prefix + " / " + name
		}
		m[f.ID] = name
		buildFolderMap(f.Folder, name, m)
	}
}

func hoppToRequest(req *hoppRequest, collID string, folderMap map[string]string, now string) models.SavedRequest {
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = "GET"
	}
	name := req.Name
	if prefix, ok := folderMap[req.FolderID]; ok {
		name = prefix + " / " + name
	}
	headers := []models.Header{}
	for _, h := range req.Headers {
		headers = append(headers, models.Header{Key: h.Key, Value: h.Value, Enabled: h.Active})
	}
	params := []models.Header{}
	for _, p := range req.Params {
		params = append(params, models.Header{Key: p.Key, Value: p.Value, Enabled: p.Active})
	}
	bodyType := "none"
	body := ""
	if req.Body != "" {
		bodyType = "json"
		body = req.Body
	}
	authType := "none"
	authValue := ""
	if req.Auth != nil {
		switch req.Auth.Type {
		case "bearer":
			authType = "bearer"
			authValue = req.Auth.Bearer
		case "basic":
			authType = "basic"
			authValue = req.Auth.Username + ":" + req.Auth.Password
		}
	}
	return models.SavedRequest{
		ID:     uuid.NewString(),
		Name:   name,
		CollID: collID,
		Payload: models.RequestPayload{
			Method:    method,
			URL:       req.Endpoint,
			Headers:   headers,
			Params:    params,
			Body:      body,
			BodyType:  bodyType,
			AuthType:  authType,
			AuthValue: authValue,
		},
		CreatedAt: now,
	}
}

// Export serialises reqit requests into Hoppscotch JSON format.
func Export(requests []models.SavedRequest, name string) ([]byte, error) {
	hoppReqs := make([]hoppRequest, 0, len(requests))
	for _, r := range requests {
		headers := make([]hoppHeader, 0, len(r.Payload.Headers))
		for _, h := range r.Payload.Headers {
			headers = append(headers, hoppHeader{Key: h.Key, Value: h.Value, Active: h.Enabled})
		}
		params := make([]hoppParam, 0, len(r.Payload.Params))
		for _, p := range r.Payload.Params {
			params = append(params, hoppParam{Key: p.Key, Value: p.Value, Active: p.Enabled})
		}
		body := r.Payload.Body
		bodyType := ""
		if r.Payload.BodyType != "none" {
			bodyType = r.Payload.BodyType
		}
		auth := (*hoppAuth)(nil)
		if r.Payload.AuthType != "none" {
			a := &hoppAuth{Type: r.Payload.AuthType}
			switch r.Payload.AuthType {
			case "bearer":
				a.Bearer = r.Payload.AuthValue
			case "basic":
				parts := strings.SplitN(r.Payload.AuthValue, ":", 2)
				a.Username = parts[0]
				if len(parts) > 1 {
					a.Password = parts[1]
				}
			}
			auth = a
		}
		hoppReqs = append(hoppReqs, hoppRequest{
			ID:       uuid.NewString(),
			Name:     r.Name,
			Method:   r.Payload.Method,
			Endpoint: r.Payload.URL,
			Params:   params,
			Headers:  headers,
			Body:     body,
			BodyType: bodyType,
			Auth:     auth,
		})
	}
	col := hoppCollection{
		ID:      uuid.NewString(),
		Name:    name,
		Request: hoppReqs,
	}
	exp := hoppExport{V: 4, Collections: []hoppCollection{col}}
	return json.MarshalIndent(exp, "", "  ")
}
