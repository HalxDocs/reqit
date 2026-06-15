package openapi

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"

	"flux/internal/models"
)

// ImportResult holds the collections generated from an OpenAPI spec.
type ImportResult struct {
	Collections []models.Collection `json:"collections"`
	Endpoints   int                  `json:"endpoints"`
	SpecTitle   string               `json:"specTitle"`
	SpecVersion string               `json:"specVersion"`
}

// Import parses an OpenAPI 3.x spec file and generates reqit collections and requests.
func Import(path string) (*ImportResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read spec: %w", err)
	}

	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = false
	doc, err := loader.LoadFromData(data)
	if err != nil {
		return nil, fmt.Errorf("parse spec: %w", err)
	}

	if doc.Paths == nil {
		return nil, fmt.Errorf("spec has no paths")
	}

	result := &ImportResult{
		SpecTitle:   doc.Info.Title,
		SpecVersion: doc.Info.Version,
	}

	type endpoint struct {
		method string
		path   string
		item   *openapi3.Operation
	}
	tagged := make(map[string][]endpoint)

	for p, pathItem := range doc.Paths.Map() {
		ops := map[string]*openapi3.Operation{
			"GET":     pathItem.Get,
			"POST":    pathItem.Post,
			"PUT":     pathItem.Put,
			"PATCH":   pathItem.Patch,
			"DELETE":  pathItem.Delete,
			"HEAD":    pathItem.Head,
			"OPTIONS": pathItem.Options,
		}
		for method, op := range ops {
			if op == nil {
				continue
			}
			tag := "default"
			if len(op.Tags) > 0 {
				tag = op.Tags[0]
			}
			tagged[tag] = append(tagged[tag], endpoint{method, p, op})
		}
	}

	for tag, eps := range tagged {
		coll := models.Collection{
			ID:   fmt.Sprintf("spec-%s", slugify(tag)),
			Name: fmt.Sprintf("%s — %s", doc.Info.Title, tag),
		}
		for _, ep := range eps {
			req := buildRequest(doc, ep.method, ep.path, ep.item)
			coll.Requests = append(coll.Requests, req)
		}
		result.Endpoints += len(eps)
		result.Collections = append(result.Collections, coll)
	}

	if len(result.Collections) == 0 {
		return nil, fmt.Errorf("no parseable endpoints found in spec")
	}

	return result, nil
}

func buildRequest(doc *openapi3.T, method, path string, op *openapi3.Operation) models.SavedRequest {
	payload := models.RequestPayload{
		Method:   strings.ToUpper(method),
		URL:      path,
		Headers:  []models.Header{},
		Params:   []models.Header{},
		BodyType: "none",
		Body:     "",
	}

	if op.Parameters != nil {
		for _, p := range op.Parameters {
			if p.Value == nil {
				continue
			}
			switch p.Value.In {
			case "query":
				var defaultVal string
				if p.Value.Schema != nil && p.Value.Schema.Value != nil {
					defaultVal = fmt.Sprintf("%v", p.Value.Schema.Value.Default)
				}
				payload.Params = append(payload.Params, models.Header{
					Key:     p.Value.Name,
					Value:   defaultVal,
					Enabled: p.Value.Required,
				})
			case "header":
				var defaultVal string
				if p.Value.Schema != nil && p.Value.Schema.Value != nil {
					defaultVal = fmt.Sprintf("%v", p.Value.Schema.Value.Default)
				}
				payload.Headers = append(payload.Headers, models.Header{
					Key:     p.Value.Name,
					Value:   defaultVal,
					Enabled: p.Value.Required,
				})
			}
		}
	}

	if op.RequestBody != nil && op.RequestBody.Value != nil {
		for mediaType, content := range op.RequestBody.Value.Content {
			if strings.Contains(mediaType, "json") {
				payload.BodyType = "json"
				if content.Schema != nil && content.Schema.Value != nil {
					schemaBytes, _ := json.MarshalIndent(content.Schema.Value, "", "  ")
					payload.Body = string(schemaBytes)
				}
				break
			} else if strings.Contains(mediaType, "form") || strings.Contains(mediaType, "urlencoded") {
				payload.BodyType = "urlencoded"
				if content.Schema != nil && content.Schema.Value != nil {
					for propName := range content.Schema.Value.Properties {
						payload.BodyForm = append(payload.BodyForm, models.Header{
							Key:     propName,
							Value:   "",
							Enabled: true,
						})
					}
				}
				break
			}
		}
	}

	if op.Security != nil && len(*op.Security) > 0 && doc.Components != nil {
		for _, req := range *op.Security {
			for schemeName := range req {
				scheme, ok := doc.Components.SecuritySchemes[schemeName]
				if !ok || scheme == nil || scheme.Value == nil {
					continue
				}
				switch scheme.Value.Scheme {
				case "bearer":
					payload.AuthType = "bearer"
					payload.AuthValue = "{{token}}"
				case "basic":
					payload.AuthType = "basic"
					payload.AuthValue = "{{username}}:{{password}}"
				}
			}
		}
	}

	name := op.Summary
	if name == "" {
		name = method + " " + path
	}

	return models.SavedRequest{
		ID:      fmt.Sprintf("ep-%s-%s", slugify(method), slugify(path)),
		Name:    name,
		Payload: payload,
	}
}

func slugify(s string) string {
	var out strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			out.WriteRune(r)
		} else if r == ' ' || r == '/' || r == '_' {
			out.WriteRune('-')
		}
	}
	return out.String()
}
