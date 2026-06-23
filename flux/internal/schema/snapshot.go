package schema

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

// Snapshot is a normalized representation of an OpenAPI spec's structure.
// It captures the "shape" of the API — endpoints, parameters, types —
// without the noise of descriptions, examples, or vendor extensions.
type Snapshot struct {
	Version   string     `json:"version"`
	Endpoints []Endpoint `json:"endpoints"`
}

// Endpoint represents a single API endpoint in the snapshot.
type Endpoint struct {
	Method      string     `json:"method"`
	Path        string     `json:"path"`
	OperationID string     `json:"operationId,omitempty"`
	Parameters  []Param    `json:"parameters,omitempty"`
	RequestBody *SchemaRef `json:"requestBody,omitempty"`
	Responses   []Response `json:"responses"`
	Tags        []string   `json:"tags,omitempty"`
}

// Param represents a request parameter.
type Param struct {
	Name     string    `json:"name"`
	In       string    `json:"in"` // query, header, path, cookie
	Required bool      `json:"required"`
	Schema   *SchemaRef `json:"schema,omitempty"`
}

// Response represents an expected response.
type Response struct {
	StatusCode string    `json:"statusCode"`
	Schema     *SchemaRef `json:"schema,omitempty"`
}

// SchemaRef is a simplified JSON Schema representation.
type SchemaRef struct {
	Type       string                `json:"type,omitempty"`
	Format     string                `json:"format,omitempty"`
	Ref        string                `json:"$ref,omitempty"`
	Items      *SchemaRef            `json:"items,omitempty"`
	Properties map[string]*SchemaRef `json:"properties,omitempty"`
	Required   []string              `json:"required,omitempty"`
	Enum       []interface{}         `json:"enum,omitempty"`
}

// CaptureSnapshot reads an OpenAPI spec and produces a normalized snapshot.
func CaptureSnapshot(path string) (*Snapshot, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile(path)
	if err != nil {
		return nil, err
	}

	snap := &Snapshot{
		Version: doc.OpenAPI,
	}

	for pathStr, pathItem := range doc.Paths.Map() {
		for _, method := range []string{"get", "post", "put", "patch", "delete", "head", "options", "trace"} {
			op := pathItem.GetOperation(strings.ToUpper(method))
			if op == nil {
				continue
			}

			ep := Endpoint{
				Method:      strings.ToUpper(method),
				Path:        pathStr,
				OperationID: op.OperationID,
				Tags:        op.Tags,
			}

			// Parameters
			for _, p := range op.Parameters {
				if p.Value == nil {
					continue
				}
				param := Param{
					Name:     p.Value.Name,
					In:       string(p.Value.In),
					Required: p.Value.Required,
				}
				if p.Value.Schema != nil && p.Value.Schema.Value != nil {
					param.Schema = simplifySchema(p.Value.Schema.Value)
				}
				ep.Parameters = append(ep.Parameters, param)
			}

			// Request body
			if op.RequestBody != nil && op.RequestBody.Value != nil {
				if mt := op.RequestBody.Value.Content.Get("application/json"); mt != nil && mt.Schema != nil && mt.Schema.Value != nil {
					ep.RequestBody = simplifySchema(mt.Schema.Value)
				}
			}

			// Responses
			for code, resp := range op.Responses.Map() {
				if resp.Value == nil {
					continue
				}
				r := Response{StatusCode: code}
				if mt := resp.Value.Content.Get("application/json"); mt != nil && mt.Schema != nil && mt.Schema.Value != nil {
					r.Schema = simplifySchema(mt.Schema.Value)
				}
				ep.Responses = append(ep.Responses, r)
			}

			// Sort responses for deterministic comparison
			sort.Slice(ep.Responses, func(i, j int) bool {
				return ep.Responses[i].StatusCode < ep.Responses[j].StatusCode
			})

			snap.Endpoints = append(snap.Endpoints, ep)
		}
	}

	// Sort endpoints for deterministic comparison
	sort.Slice(snap.Endpoints, func(i, j int) bool {
		a := snap.Endpoints[i]
		b := snap.Endpoints[j]
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Method < b.Method
	})

	return snap, nil
}

// simplifySchema reduces an openapi3.Schema to our minimal SchemaRef format.
func simplifySchema(s *openapi3.Schema) *SchemaRef {
	if s == nil {
		return nil
	}

	ref := &SchemaRef{
		Format: s.Format,
	}

	if s.Type != nil {
		types := []string(*s.Type)
		if len(types) == 1 {
			ref.Type = types[0]
		} else if len(types) > 1 {
			ref.Type = strings.Join(types, ",")
		}
	}

	if len(s.Enum) > 0 {
		ref.Enum = s.Enum
	}

	if s.Items != nil && s.Items.Value != nil {
		ref.Items = simplifySchema(s.Items.Value)
	}

	if len(s.Properties) > 0 {
		ref.Properties = make(map[string]*SchemaRef)
		for name, prop := range s.Properties {
			if prop.Value != nil {
				ref.Properties[name] = simplifySchema(prop.Value)
			}
		}
	}

	if len(s.Required) > 0 {
		ref.Required = s.Required
		sort.Strings(ref.Required)
	}

	return ref
}

// SaveSnapshot writes a snapshot to the snapshots directory.
func SaveSnapshot(wsDir, specName string, snap *Snapshot) error {
	dir := filepath.Join(wsDir, ".reqit", "snapshots")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return err
	}

	slug := strings.TrimSuffix(specName, filepath.Ext(specName))
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ToLower(slug)

	path := filepath.Join(dir, slug+".snapshot.json")
	return os.WriteFile(path, data, 0644)
}

// LoadSnapshot reads a snapshot from the snapshots directory.
func LoadSnapshot(wsDir, specName string) (*Snapshot, error) {
	dir := filepath.Join(wsDir, ".reqit", "snapshots")

	slug := strings.TrimSuffix(specName, filepath.Ext(specName))
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ToLower(slug)

	path := filepath.Join(dir, slug+".snapshot.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var snap Snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, err
	}

	return &snap, nil
}
