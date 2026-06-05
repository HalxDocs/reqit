package openapi

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"

	"flux/internal/models"
)

// Export generates an OpenAPI 3.0.3 specification from a collection.
func Export(coll models.Collection) (string, error) {
	doc := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   coll.Name,
			Version: "1.0.0",
		},
		Paths: openapi3.NewPaths(),
		Components: &openapi3.Components{
			SecuritySchemes: make(openapi3.SecuritySchemes),
		},
	}

	// Group requests by URL path + method.
	type endpoint struct {
		method   string
		summary  string
		params   []models.Header
		body     string
		bodyTyp  string
		bodyForm []models.Header
		authTyp  string
		authVal  string
	}
	seen := make(map[string]map[string]*endpoint) // path -> method -> endpoint

	for _, req := range coll.Requests {
		p := req.Payload
		epPath := extractPath(p.URL)
		if epPath == "" {
			continue
		}

		method := strings.ToLower(p.Method)
		if method == "" {
			method = "get"
		}

		eps, ok := seen[epPath]
		if !ok {
			eps = make(map[string]*endpoint)
			seen[epPath] = eps
		}
		if _, exists := eps[method]; exists {
			continue
		}
		eps[method] = &endpoint{
			method:   method,
			summary:  req.Name,
			params:   p.Params,
			body:     p.Body,
			bodyTyp:  p.BodyType,
			bodyForm: p.BodyForm,
			authTyp:  p.AuthType,
			authVal:  p.AuthValue,
		}
	}

	// Build paths in sorted order for deterministic output.
	epPaths := make([]string, 0, len(seen))
	for p := range seen {
		epPaths = append(epPaths, p)
	}
	sort.Strings(epPaths)

	for _, epPath := range epPaths {
		eps := seen[epPath]
		pathItem := &openapi3.PathItem{}

		methods := make([]string, 0, len(eps))
		for m := range eps {
			methods = append(methods, m)
		}
		sort.Strings(methods)

		for _, method := range methods {
			ep := eps[method]
			resps := openapi3.NewResponses()
			resps.Set("200", &openapi3.ResponseRef{
				Value: openapi3.NewResponse().WithDescription(ep.summary + " response"),
			})
			op := &openapi3.Operation{
				Summary:     ep.summary,
				OperationID: fmt.Sprintf("%s%s", method, strings.ReplaceAll(strings.ReplaceAll(epPath, "/", "_"), "-", "_")),
				Responses:   resps,
			}

			// Query parameters
			for _, qp := range ep.params {
				if !qp.Enabled || qp.Key == "" {
					continue
				}
				op.Parameters = append(op.Parameters, &openapi3.ParameterRef{
					Value: &openapi3.Parameter{
						Name:     qp.Key,
						In:       "query",
						Required: false,
						Schema:   openapi3.NewStringSchema().NewRef(),
					},
				})
			}

			// Request body
			if ep.bodyTyp == "json" && strings.TrimSpace(ep.body) != "" {
				op.RequestBody = &openapi3.RequestBodyRef{
					Value: &openapi3.RequestBody{
						Required: true,
						Content: openapi3.NewContentWithJSONSchema(
							inferSchemaFromJSON(ep.body),
						),
					},
				}
			} else if ep.bodyTyp == "urlencoded" || ep.bodyTyp == "form" {
				schema := openapi3.NewObjectSchema()
				for _, f := range ep.bodyForm {
					if f.Enabled && f.Key != "" {
						schema.Properties[f.Key] = openapi3.NewStringSchema().NewRef()
					}
				}
				op.RequestBody = &openapi3.RequestBodyRef{
					Value: &openapi3.RequestBody{
						Required: true,
						Content: openapi3.NewContentWithFormDataSchema(schema),
					},
				}
			}

			setOperationByMethod(pathItem, method, op)

			// Security
			if ep.authTyp != "" && ep.authTyp != "none" {
				registerAuth(doc, ep.authTyp, ep.authVal)
				op.Security = &openapi3.SecurityRequirements{
					{ep.authTyp: []string{}},
				}
			}
		}

		doc.Paths.Set(epPath, pathItem)
	}

	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func setOperationByMethod(pi *openapi3.PathItem, method string, op *openapi3.Operation) {
	switch method {
	case "get":
		pi.Get = op
	case "post":
		pi.Post = op
	case "put":
		pi.Put = op
	case "patch":
		pi.Patch = op
	case "delete":
		pi.Delete = op
	case "head":
		pi.Head = op
	case "options":
		pi.Options = op
	}
}

func registerAuth(doc *openapi3.T, authTyp, authVal string) {
	switch authTyp {
	case "bearer":
		if _, ok := doc.Components.SecuritySchemes["bearer"]; !ok {
			doc.Components.SecuritySchemes["bearer"] = &openapi3.SecuritySchemeRef{
				Value: &openapi3.SecurityScheme{
					Type: "http",
					Scheme: "bearer",
				},
			}
		}
	case "basic":
		if _, ok := doc.Components.SecuritySchemes["basic"]; !ok {
			doc.Components.SecuritySchemes["basic"] = &openapi3.SecuritySchemeRef{
				Value: &openapi3.SecurityScheme{
					Type: "http",
					Scheme: "basic",
				},
			}
		}
	case "apikey":
		if _, ok := doc.Components.SecuritySchemes["apikey"]; !ok {
			parts := strings.SplitN(authVal, ":", 3)
			in := "header"
			name := "X-API-Key"
			if len(parts) == 3 {
				in = parts[0]
				name = parts[1]
			}
			doc.Components.SecuritySchemes["apikey"] = &openapi3.SecuritySchemeRef{
				Value: &openapi3.SecurityScheme{
					Type: "apiKey",
					In:   in,
					Name: name,
				},
			}
		}
	}
}

// extractPath extracts the URL path from a raw URL string.
func extractPath(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "https://" + rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	p := u.Path
	if p == "" {
		p = "/"
	}
	// Remove trailing slash for consistency
	if len(p) > 1 && strings.HasSuffix(p, "/") {
		p = strings.TrimSuffix(p, "/")
	}
	return p
}

// inferSchemaFromJSON attempts to parse a JSON body and return a schema.
// Falls back to string schema.
func inferSchemaFromJSON(body string) *openapi3.Schema {
	var v any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return openapi3.NewStringSchema()
	}
	return jsToSchema(v)
}

func jsToSchema(v any) *openapi3.Schema {
	switch val := v.(type) {
	case map[string]any:
		s := openapi3.NewObjectSchema()
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			s.Properties[k] = jsToSchema(val[k]).NewRef()
		}
		return s
	case []any:
		s := openapi3.NewArraySchema()
		if len(val) > 0 {
			s.Items = jsToSchema(val[0]).NewRef()
		} else {
			s.Items = openapi3.NewStringSchema().NewRef()
		}
		return s
	case float64:
		if val == float64(int64(val)) {
			return openapi3.NewIntegerSchema()
		}
		return openapi3.NewFloat64Schema()
	case bool:
		return openapi3.NewBoolSchema()
	case string:
		return openapi3.NewStringSchema()
	default:
		return openapi3.NewStringSchema()
	}
}


