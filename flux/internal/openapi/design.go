package openapi

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

// SpecDesign provides programmatic spec construction and editing.
type SpecDesign struct {
	doc   *openapi3.T
	path  string
	dirty bool
}

// NewSpecDesign creates a new blank spec.
func NewSpecDesign(title, version string) *SpecDesign {
	return &SpecDesign{
		doc: &openapi3.T{
			OpenAPI: "3.0.3",
			Info: &openapi3.Info{
				Title:   title,
				Version: version,
			},
			Paths:      openapi3.NewPaths(),
			Components: &openapi3.Components{},
		},
		dirty: true,
	}
}

// LoadSpecDesign loads an existing spec from a file.
func LoadSpecDesign(path string) (*SpecDesign, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(data)
	if err != nil {
		return nil, err
	}
	if doc.Components == nil {
		doc.Components = &openapi3.Components{}
	}
	return &SpecDesign{doc: doc, path: path}, nil
}

// AddEndpoint adds a path+method to the spec.
func (sd *SpecDesign) AddEndpoint(method, path, summary string) {
	method = strings.ToUpper(method)
	item := sd.doc.Paths.Value(path)
	if item == nil {
		item = &openapi3.PathItem{}
		sd.doc.Paths.Set(path, item)
	}
	op := &openapi3.Operation{
		Summary: summary,
	}
	op.AddResponse(200, openapi3.NewResponse().WithDescription("Success"))
	switch method {
	case "GET":
		item.Get = op
	case "POST":
		item.Post = op
	case "PUT":
		item.Put = op
	case "PATCH":
		item.Patch = op
	case "DELETE":
		item.Delete = op
	case "HEAD":
		item.Head = op
	case "OPTIONS":
		item.Options = op
	}
	sd.dirty = true
}

// SetEndpointDescription updates the description/summary of an endpoint.
func (sd *SpecDesign) SetEndpointDescription(method, path, summary, description string) {
	op := sd.getOperation(method, path)
	if op == nil {
		return
	}
	op.Summary = summary
	op.Description = description
	sd.dirty = true
}

// AddQueryParam adds a query parameter to an endpoint.
func (sd *SpecDesign) AddQueryParam(method, path, name string, required bool, paramType string) {
	op := sd.getOperation(method, path)
	if op == nil {
		return
	}
	op.AddParameter(&openapi3.Parameter{
		Name:     name,
		In:       "query",
		Required: required,
		Schema: &openapi3.SchemaRef{
			Value: &openapi3.Schema{
				Type: &openapi3.Types{paramType},
			},
		},
	})
	sd.dirty = true
}

// SetRequestBodyJSON sets the request body schema for an endpoint.
func (sd *SpecDesign) SetRequestBodyJSON(method, path, jsonSchema string) error {
	op := sd.getOperation(method, path)
	if op == nil {
		return fmt.Errorf("endpoint %s %s not found", method, path)
	}
	var schema openapi3.Schema
	if err := json.Unmarshal([]byte(jsonSchema), &schema); err != nil {
		return fmt.Errorf("invalid JSON schema: %w", err)
	}
	op.RequestBody = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Required: true,
			Content: map[string]*openapi3.MediaType{
				"application/json": {
					Schema: &openapi3.SchemaRef{Value: &schema},
				},
			},
		},
	}
	sd.dirty = true
	return nil
}

// RemoveEndpoint removes a path (all methods) or a specific method from the spec.
func (sd *SpecDesign) RemoveEndpoint(method, path string) {
	method = strings.ToUpper(method)
	item := sd.doc.Paths.Value(path)
	if item == nil {
		return
	}
	switch method {
	case "GET":
		item.Get = nil
	case "POST":
		item.Post = nil
	case "PUT":
		item.Put = nil
	case "PATCH":
		item.Patch = nil
	case "DELETE":
		item.Delete = nil
	case "HEAD":
		item.Head = nil
	case "OPTIONS":
		item.Options = nil
	}
	// If no operations remain, remove the path entirely.
	if item.Get == nil && item.Post == nil && item.Put == nil &&
		item.Patch == nil && item.Delete == nil &&
		item.Head == nil && item.Options == nil {
		sd.doc.Paths.Delete(path)
	}
	sd.dirty = true
}

// Save writes the spec to its file path and returns the actual path used.
func (sd *SpecDesign) Save() (string, error) {
	if !sd.dirty {
		return sd.path, nil
	}
	data, err := sd.doc.MarshalJSON()
	if err != nil {
		return "", err
	}
	path := sd.path
	if path == "" {
		path = fmt.Sprintf("%s.openapi.json", slugify(sd.doc.Info.Title))
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", err
	}
	sd.path = path
	sd.dirty = false
	return path, nil
}

// Path returns the file path of the spec.
func (sd *SpecDesign) Path() string { return sd.path }

// Endpoints returns a summary of all endpoints.
func (sd *SpecDesign) Endpoints() []EndpointSummary {
	var out []EndpointSummary
	for _, p := range sd.doc.Paths.Keys() {
		item := sd.doc.Paths.Value(p)
		for method, op := range map[string]*openapi3.Operation{
			"GET": item.Get, "POST": item.Post, "PUT": item.Put,
			"PATCH": item.Patch, "DELETE": item.Delete, "HEAD": item.Head, "OPTIONS": item.Options,
		} {
			if op == nil {
				continue
			}
			out = append(out, EndpointSummary{
				Method:      method,
				Path:        p,
				Summary:     op.Summary,
				Description: op.Description,
			})
		}
	}
	return out
}

func (sd *SpecDesign) getOperation(method, path string) *openapi3.Operation {
	item := sd.doc.Paths.Value(path)
	if item == nil {
		return nil
	}
	switch strings.ToUpper(method) {
	case "GET":
		return item.Get
	case "POST":
		return item.Post
	case "PUT":
		return item.Put
	case "PATCH":
		return item.Patch
	case "DELETE":
		return item.Delete
	case "HEAD":
		return item.Head
	case "OPTIONS":
		return item.Options
	}
	return nil
}

// EndpointSummary is a lightweight view of an endpoint.
type EndpointSummary struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Summary     string `json:"summary"`
	Description string `json:"description,omitempty"`
}


