package scripting

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dop251/goja"
	"flux/internal/models"
)

type RequestAPI struct {
	Method  string   `json:"method"`
	URL     string   `json:"url"`
	Headers []Header `json:"headers"`
	Body    string   `json:"body"`
}

type Header struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type ResponseAPI struct {
	Status     int               `json:"status"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
	TimingMs   int64             `json:"responseTime"`
}

type VarStore struct {
	store map[string]string
}

func (v *VarStore) Set(key, value string) {
	v.store[key] = value
}

func (v *VarStore) Get(key string) string {
	return v.store[key]
}

func headersToAPI(hs []models.Header) []Header {
	out := make([]Header, len(hs))
	for i, h := range hs {
		out[i] = Header{Key: h.Key, Value: h.Value, Enabled: h.Enabled}
	}
	return out
}

func RunPreScript(script string, payload *models.RequestPayload) (map[string]string, error) {
	if strings.TrimSpace(script) == "" {
		return nil, nil
	}

	vm := goja.New()
	vars := &VarStore{store: make(map[string]string)}

	reqObj := vm.NewObject()
	_ = reqObj.Set("method", payload.Method)
	_ = reqObj.Set("url", payload.URL)
	_ = reqObj.Set("headers", headersToAPI(payload.Headers))
	_ = reqObj.Set("body", payload.Body)

	pmObj := vm.NewObject()
	_ = pmObj.Set("request", reqObj)
	_ = pmObj.Set("variables", vars)
	_ = vm.Set("pm", pmObj)

	if _, err := vm.RunString(script); err != nil {
		return nil, fmt.Errorf("pre-script error: %w", err)
	}

	methodVal := reqObj.Get("method")
	if methodVal.String() != "" {
		payload.Method = methodVal.String()
	}
	urlVal := reqObj.Get("url")
	if urlVal.String() != "" {
		payload.URL = urlVal.String()
	}
	bodyVal := reqObj.Get("body")
	payload.Body = bodyVal.String()

	if hVal := reqObj.Get("headers"); hVal != nil && !goja.IsUndefined(hVal) && !goja.IsNull(hVal) {
		exported := hVal.Export()
		if arr, ok := exported.([]interface{}); ok {
			for i, raw := range arr {
				if i >= len(payload.Headers) {
					break
				}
				if m, ok := raw.(map[string]interface{}); ok {
					if key, _ := m["key"].(string); key != "" {
						payload.Headers[i].Key = key
					}
					if val, _ := m["value"].(string); val != "" {
						payload.Headers[i].Value = val
					}
					if enabled, _ := m["enabled"].(bool); enabled {
						payload.Headers[i].Enabled = enabled
					}
				}
			}
		}
	}

	return vars.store, nil
}

func RunPostScript(script string, payload *models.RequestPayload, result *models.ResponseResult) (map[string]string, error) {
	if strings.TrimSpace(script) == "" {
		return nil, nil
	}

	vm := goja.New()
	vars := &VarStore{store: make(map[string]string)}

	respObj := vm.NewObject()
	_ = respObj.Set("status", result.StatusCode)
	_ = respObj.Set("body", result.Body)
	if result.Headers != nil {
		_ = respObj.Set("headers", result.Headers)
	} else {
		_ = respObj.Set("headers", map[string]string{})
	}
	_ = respObj.Set("responseTime", result.TimingMs)

	reqObj := vm.NewObject()
	_ = reqObj.Set("method", payload.Method)
	_ = reqObj.Set("url", payload.URL)
	_ = reqObj.Set("body", payload.Body)

	pmObj := vm.NewObject()
	_ = pmObj.Set("response", respObj)
	_ = pmObj.Set("request", reqObj)
	_ = pmObj.Set("variables", vars)
	_ = vm.Set("pm", pmObj)

	if _, err := vm.RunString(script); err != nil {
		return nil, fmt.Errorf("post-script error: %w", err)
	}

	return vars.store, nil
}

type ScriptEnv struct {
	Vars map[string]string `json:"vars"`
}

func ExtractVars(source map[string]string) string {
	if len(source) == 0 {
		return "{}"
	}
	b, _ := json.Marshal(source)
	return string(b)
}
