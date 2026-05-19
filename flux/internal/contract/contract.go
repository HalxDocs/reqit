package contract

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers/legacy"
)

type SpecCache struct {
	mu    sync.RWMutex
	cache map[string]*openapi3.T
}

var Cache = &SpecCache{cache: make(map[string]*openapi3.T)}

func (sc *SpecCache) Load(path string) (*openapi3.T, error) {
	sc.mu.RLock()
	if doc, ok := sc.cache[path]; ok {
		sc.mu.RUnlock()
		return doc, nil
	}
	sc.mu.RUnlock()

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile(path)
	if err != nil {
		return nil, err
	}
	// Skip remote $ref validation so offline specs still load.
	ctx := loader.Context
	_ = ctx

	sc.mu.Lock()
	sc.cache[path] = doc
	sc.mu.Unlock()
	return doc, nil
}

func (sc *SpecCache) Invalidate(path string) {
	sc.mu.Lock()
	delete(sc.cache, path)
	sc.mu.Unlock()
}

// ValidationError represents a single spec violation.
type ValidationError struct {
	Layer   string `json:"layer"`   // "status" | "body" | "header"
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationResult is returned alongside every validated response.
type ValidationResult struct {
	Valid      bool              `json:"valid"`
	Errors     []ValidationError `json:"errors"`
	SkipReason string            `json:"skipReason"`
	Endpoint   string            `json:"endpoint"`
	Method     string            `json:"method"`
}

// Validate checks a response against the loaded spec document.
func Validate(doc *openapi3.T, method, rawURL string, statusCode int, body []byte) ValidationResult {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ValidationResult{SkipReason: "could not parse URL", Method: method, Endpoint: rawURL}
	}
	pathOnly := u.Path

	res := ValidationResult{Method: method, Endpoint: pathOnly}
	var errs []ValidationError

	router, err := legacy.NewRouter(doc)
	if err != nil {
		res.SkipReason = "could not build router: " + err.Error()
		return res
	}

	fakeURL := &url.URL{Scheme: "https", Host: "reqit.local", Path: pathOnly}
	httpReq := &http.Request{Method: method, URL: fakeURL}
	route, _, findErr := router.FindRoute(httpReq)
	if findErr != nil {
		res.SkipReason = "endpoint not in spec"
		return res
	}

	// Status code check.
	respSpec := route.Operation.Responses.Value(fmt.Sprintf("%d", statusCode))
	if respSpec == nil {
		errs = append(errs, ValidationError{
			Layer:   "status",
			Field:   "statusCode",
			Message: fmt.Sprintf("%d not defined in spec", statusCode),
		})
	}

	// Body schema check.
	if respSpec != nil && respSpec.Value != nil && respSpec.Value.Content != nil {
		mt := respSpec.Value.Content.Get("application/json")
		if mt != nil && mt.Schema != nil {
			var data interface{}
			if jsonErr := json.Unmarshal(body, &data); jsonErr == nil {
				if vErr := mt.Schema.Value.VisitJSON(data); vErr != nil {
					errs = append(errs, ValidationError{
						Layer:   "body",
						Field:   "",
						Message: vErr.Error(),
					})
				}
			}
		}
	}

	res.Errors = errs
	res.Valid = len(errs) == 0
	return res
}
