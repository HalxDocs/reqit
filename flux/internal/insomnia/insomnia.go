package insomnia

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
)

type insomniaDoc struct {
	Type      string          `json:"_type"`
	ParentID  string          `json:"parentId"`
	ID        string          `json:"_id"`
	Name      string          `json:"name"`
	Method    string          `json:"method"`
	URL       string          `json:"url"`
	Headers   []insomniaHeader `json:"headers"`
	Body      *insomniaBody   `json:"body"`
	Resources []insomniaDoc   `json:"resources"`
	Children  []insomniaDoc   `json:"children"`
	Auth      *insomniaAuth   `json:"authentication"`
	Scope     string          `json:"scope"`
	Data      json.RawMessage `json:"data"`
}

type insomniaHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type insomniaBody struct {
	MimeType string          `json:"mimeType"`
	Text     string          `json:"text"`
	Params   []insomniaParam `json:"params"`
}

type insomniaParam struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type insomniaAuth struct {
	Type    string            `json:"type"`
	Token   string            `json:"token"`
	User    string            `json:"user"`
	Pass    string            `json:"password"`
	Key     string            `json:"key"`
	Value   string            `json:"value"`
	Disable bool              `json:"disabled"`
}

type insomniaExport struct {
	Resources []insomniaDoc `json:"resources"`
}

// ImportResult holds parsed Insomnia data.
type ImportResult struct {
	Requests []models.SavedRequest `json:"requests"`
	Envs     map[string]string     `json:"envs"`
}

// Import parses an Insomnia export JSON file.
func Import(data []byte, collID string) (*ImportResult, error) {
	if len(data) == 0 {
		return nil, errors.New("empty file")
	}
	// Try as insomnia export format
	var exp insomniaExport
	if json.Unmarshal(data, &exp) == nil && len(exp.Resources) > 0 {
		return parseResources(exp.Resources, collID)
	}
	// Try as single document
	var doc insomniaDoc
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return parseDoc(&doc, collID)
}

func parseResources(resources []insomniaDoc, collID string) (*ImportResult, error) {
	result := &ImportResult{
		Requests: []models.SavedRequest{},
		Envs:     map[string]string{},
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, r := range resources {
		switch r.Type {
		case "request":
			req := insomniaDocToRequest(&r, collID, now)
			if req != nil {
				result.Requests = append(result.Requests, *req)
			}
		case "request_group":
			for _, child := range r.Children {
				if child.Type == "request" {
					child.Name = r.Name + " / " + child.Name
					req := insomniaDocToRequest(&child, collID, now)
					if req != nil {
						result.Requests = append(result.Requests, *req)
					}
				}
			}
		case "environment":
			if r.Data != nil {
				var envMap map[string]interface{}
				if json.Unmarshal(r.Data, &envMap) == nil {
					for k, v := range envMap {
						result.Envs[k] = fmt.Sprint(v)
					}
				}
			}
		}
	}
	return result, nil
}

func parseDoc(doc *insomniaDoc, collID string) (*ImportResult, error) {
	if doc.Type == "request" {
		now := time.Now().UTC().Format(time.RFC3339)
		req := insomniaDocToRequest(doc, collID, now)
		if req == nil {
			return &ImportResult{}, nil
		}
		return &ImportResult{Requests: []models.SavedRequest{*req}}, nil
	}
	if doc.Resources != nil {
		return parseResources(doc.Resources, collID)
	}
	return &ImportResult{}, nil
}

func insomniaDocToRequest(doc *insomniaDoc, collID, now string) *models.SavedRequest {
	method := strings.ToUpper(strings.TrimSpace(doc.Method))
	if method == "" {
		method = "GET"
	}
	headers := []models.Header{}
	for _, h := range doc.Headers {
		headers = append(headers, models.Header{Key: h.Name, Value: h.Value, Enabled: true})
	}
	bodyType := "none"
	body := ""
	bodyForm := []models.Header{}
	if doc.Body != nil {
		mt := strings.ToLower(doc.Body.MimeType)
		switch {
		case strings.Contains(mt, "json"):
			bodyType = "json"
			body = doc.Body.Text
		case strings.Contains(mt, "xml"):
			bodyType = "xml"
			body = doc.Body.Text
		case strings.Contains(mt, "form") || strings.Contains(mt, "urlencoded"):
			bodyType = "urlencoded"
			for _, p := range doc.Body.Params {
				bodyForm = append(bodyForm, models.Header{Key: p.Name, Value: p.Value, Enabled: true})
			}
		case strings.Contains(mt, "x-www-form-urlencoded"):
			bodyType = "urlencoded"
			for _, p := range doc.Body.Params {
				bodyForm = append(bodyForm, models.Header{Key: p.Name, Value: p.Value, Enabled: true})
			}
		default:
			bodyType = "raw"
			body = doc.Body.Text
		}
	}
	authType := "none"
	authValue := ""
	if doc.Auth != nil && !doc.Auth.Disable {
		switch doc.Auth.Type {
		case "bearer":
			authType = "bearer"
			authValue = doc.Auth.Token
		case "basic":
			authType = "basic"
			authValue = doc.Auth.User + ":" + doc.Auth.Pass
		}
	}
	return &models.SavedRequest{
		ID:        uuid.NewString(),
		Name:      doc.Name,
		CollID:    collID,
		CreatedAt: now,
		Payload: models.RequestPayload{
			Method:    method,
			URL:       doc.URL,
			Headers:   headers,
			BodyType:  bodyType,
			Body:      body,
			BodyForm:  bodyForm,
			AuthType:  authType,
			AuthValue: authValue,
		},
	}
}

// Export serialises requests into Insomnia JSON format.
func Export(requests []models.SavedRequest, name string) ([]byte, error) {
	resources := make([]insomniaDoc, 0, len(requests))
	for _, r := range requests {
		body := (*insomniaBody)(nil)
		bt := r.Payload.BodyType
		if bt != "none" {
			mimeType := "text/plain"
			switch bt {
			case "json":
				mimeType = "application/json"
			case "xml":
				mimeType = "application/xml"
			case "urlencoded":
				mimeType = "application/x-www-form-urlencoded"
			case "form":
				mimeType = "multipart/form-data"
			}
			body = &insomniaBody{
				MimeType: mimeType,
				Text:     r.Payload.Body,
			}
		}
		auth := (*insomniaAuth)(nil)
		if r.Payload.AuthType != "none" {
			a := &insomniaAuth{Type: r.Payload.AuthType}
			switch r.Payload.AuthType {
			case "bearer":
				a.Token = r.Payload.AuthValue
			case "basic":
				parts := strings.SplitN(r.Payload.AuthValue, ":", 2)
				a.User = parts[0]
				if len(parts) > 1 {
					a.Pass = parts[1]
				}
			}
			auth = a
		}
		headers := make([]insomniaHeader, 0, len(r.Payload.Headers))
		for _, h := range r.Payload.Headers {
			headers = append(headers, insomniaHeader{Name: h.Key, Value: h.Value})
		}
		id := uuid.NewString()
		doc := insomniaDoc{
			Type:    "request",
			ID:      id,
			ParentID: "__WORKSPACE_ID__",
			Name:    r.Name,
			Method:  r.Payload.Method,
			URL:     r.Payload.URL,
			Headers: headers,
			Body:    body,
			Auth:    auth,
		}
		resources = append(resources, doc)
	}
	exp := insomniaExport{Resources: resources}
	return json.MarshalIndent(exp, "", "  ")
}
