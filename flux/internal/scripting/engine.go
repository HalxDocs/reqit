package scripting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/dop251/goja"
	"flux/internal/models"
	"flux/internal/security"
)

const scriptTimeout = 10 * time.Second

// runScriptWithTimeout executes a goja script with a timeout to prevent infinite loops.
func runScriptWithTimeout(vm *goja.Runtime, script string) (goja.Value, error) {
	done := make(chan struct{})
	var val goja.Value
	var err error
	go func() {
		defer close(done)
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("script panic: %v", r)
			}
		}()
		val, err = vm.RunString(script)
	}()
	select {
	case <-done:
		return val, err
	case <-time.After(scriptTimeout):
		vm.Interrupt("script timeout")
		// Wait briefly for goroutine to finish after interrupt
		<-done
		return val, err
	}
}

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
	Status      int               `json:"statusCode"`
	StatusText  string            `json:"statusText"`
	Body        string            `json:"body"`
	Headers     map[string]string `json:"headers"`
	TimingMs    int64             `json:"responseTime"`
}

type VarStore struct {
	mu    sync.Mutex
	store map[string]string
	logs  []string
	pass  int
	fail  int
}

func (v *VarStore) Set(key, value string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.store[key] = value
}

func (v *VarStore) Get(key string) string {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.store[key]
}

func (v *VarStore) Log(args ...interface{}) {
	parts := make([]string, len(args))
	for i, a := range args {
		parts[i] = fmt.Sprint(a)
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	v.logs = append(v.logs, strings.Join(parts, " "))
}

func (v *VarStore) Assert(cond bool, msg string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if cond {
		v.pass++
	} else {
		v.fail++
		v.logs = append(v.logs, fmt.Sprintf("ASSERT FAIL: %s", msg))
	}
}

func headersToAPI(hs []models.Header) []Header {
	out := make([]Header, len(hs))
	for i, h := range hs {
		out[i] = Header{Key: h.Key, Value: h.Value, Enabled: h.Enabled}
	}
	return out
}

// reqSend synchronously sends a sub-request (for req.send() in scripts).
func reqSend(req map[string]interface{}) map[string]interface{} {
	url, _ := req["url"].(string)
	method, _ := req["method"].(string)
	if method == "" {
		method = "GET"
	}
	if err := security.ValidateURL(url); err != nil {
		return map[string]interface{}{
			"statusCode": 0, "body": fmt.Sprintf("Error: %v", err), "responseTime": int64(0),
		}
	}
	bodyStr, _ := req["body"].(string)

	var bodyReader io.Reader
	if bodyStr != "" {
		bodyReader = bytes.NewReader([]byte(bodyStr))
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return map[string]interface{}{
			"statusCode": 0, "body": fmt.Sprintf("Error: %v", err), "responseTime": int64(0),
		}
	}

	if h, ok := req["headers"].(map[string]interface{}); ok {
		for k, v := range h {
			httpReq.Header.Set(k, fmt.Sprint(v))
		}
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return map[string]interface{}{
			"statusCode": 0, "body": fmt.Sprintf("Error: %v", err), "responseTime": time.Since(start).Milliseconds(),
		}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 50<<20)) // 50MB limit
	respHeaders := make(map[string]string)
	for k := range resp.Header {
		respHeaders[k] = resp.Header.Get(k)
	}

	return map[string]interface{}{
		"statusCode":   resp.StatusCode,
		"statusText":   resp.Status,
		"body":         string(bodyBytes),
		"headers":      respHeaders,
		"responseTime": time.Since(start).Milliseconds(),
	}
}

// exposeReqNamespace populates a goja VM with the `req` and `reqit` namespaces.
func exposeReqNamespace(vm *goja.Runtime, vars *VarStore, reqObj, respObj *goja.Object) {
	// Build req.request
	rReq := vm.NewObject()
	_ = rReq.Set("url", reqObj.Get("url"))
	_ = rReq.Set("method", reqObj.Get("method"))
	_ = rReq.Set("body", reqObj.Get("body"))
	_ = rReq.Set("headers", reqObj.Get("headers"))

	// Build req.response
	rResp := vm.NewObject()
	if respObj != nil {
		_ = rResp.Set("statusCode", respObj.Get("statusCode"))
		_ = rResp.Set("statusText", respObj.Get("statusText"))
		_ = rResp.Set("body", respObj.Get("body"))
		_ = rResp.Set("headers", respObj.Get("headers"))
		_ = rResp.Set("json", func(call goja.FunctionCall) goja.Value {
			body := respObj.Get("body")
			if body == nil || goja.IsUndefined(body) {
				return vm.ToValue(nil)
			}
			var parsed interface{}
			if err := json.Unmarshal([]byte(body.String()), &parsed); err != nil {
				return vm.ToValue(nil)
			}
			return vm.ToValue(parsed)
		})
		_ = rResp.Set("text", func(call goja.FunctionCall) goja.Value {
			return vm.ToValue(respObj.Get("body").String())
		})
	}

	// req.variables
	rVars := vm.NewObject()
	_ = rVars.Set("get", func(call goja.FunctionCall) goja.Value {
		key := call.Argument(0).String()
		return vm.ToValue(vars.Get(key))
	})
	_ = rVars.Set("set", func(call goja.FunctionCall) goja.Value {
		key := call.Argument(0).String()
		val := call.Argument(1).String()
		vars.Set(key, val)
		return goja.Undefined()
	})

	// req.env (alias to variables)
	rEnv := vm.NewObject()
	_ = rEnv.Set("get", rVars.Get("get"))
	_ = rEnv.Set("set", rVars.Get("set"))

	// req.globals (alias to variables)
	rGlobals := vm.NewObject()
	_ = rGlobals.Set("get", rVars.Get("get"))
	_ = rGlobals.Set("set", rVars.Get("set"))

	// req.iteration (alias to variables)
	rIter := vm.NewObject()
	_ = rIter.Set("get", rVars.Get("get"))

	// req.log
	rLog := func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, a := range call.Arguments {
			args[i] = a.Export()
		}
		vars.Log(args...)
		return goja.Undefined()
	}

	// req.assert
	rAssert := func(call goja.FunctionCall) goja.Value {
		cond := call.Argument(0).ToBoolean()
		msg := call.Argument(1).String()
		vars.Assert(cond, msg)
		return goja.Undefined()
	}

	// req.expect — returns a chainable object with .to.equal / .to.be.true / .to.include
	type expectChain struct {
		vm      *goja.Runtime
		actual  interface{}
		vars    *VarStore
		negated bool
	}
	makeExpect := func(actual interface{}, v *VarStore, neg bool) *goja.Object {
		e := &expectChain{vm: vm, actual: actual, vars: v, negated: neg}
		obj := vm.NewObject()
		_ = obj.Set("equal", func(call goja.FunctionCall) goja.Value {
			expected := call.Argument(0).Export()
			pass := fmt.Sprint(actual) == fmt.Sprint(expected)
			if e.negated {
				pass = !pass
			}
			e.vars.Assert(pass, fmt.Sprintf("expected %v to equal %v", actual, expected))
			return goja.Undefined()
		})
		_ = obj.Set("include", func(call goja.FunctionCall) goja.Value {
			sub := call.Argument(0).String()
			pass := strings.Contains(fmt.Sprint(actual), sub)
			if e.negated {
				pass = !pass
			}
			e.vars.Assert(pass, fmt.Sprintf("expected %v to include %q", actual, sub))
			return goja.Undefined()
		})
		_ = obj.Set("true", func(call goja.FunctionCall) goja.Value {
			pass := fmt.Sprint(actual) == "true"
			if e.negated {
				pass = !pass
			}
			e.vars.Assert(pass, fmt.Sprintf("expected %v to be true", actual))
			return goja.Undefined()
		})
		_ = obj.Set("false", func(call goja.FunctionCall) goja.Value {
			pass := fmt.Sprint(actual) == "false"
			if e.negated {
				pass = !pass
			}
			e.vars.Assert(pass, fmt.Sprintf("expected %v to be false", actual))
			return goja.Undefined()
		})
		return obj
	}

	rExpect := func(call goja.FunctionCall) goja.Value {
		actual := call.Argument(0).Export()
		eObj := makeExpect(actual, vars, false)
		notObj := vm.NewObject()
		_ = notObj.Set("to", eObj)
		chain := vm.NewObject()
		_ = chain.Set("to", eObj)
		_ = chain.Set("not", notObj)
		// Re-bind to, not on eObj
		_ = eObj.Set("to", chain.Get("to"))
		return chain
	}

	// req.send
	rSend := func(call goja.FunctionCall) goja.Value {
		arg := call.Argument(0).Export()
		reqMap, ok := arg.(map[string]interface{})
		if !ok {
			return vm.ToValue(map[string]interface{}{"statusCode": 0, "body": "req.send() requires an object with url"})
		}
		result := reqSend(reqMap)
		return vm.ToValue(result)
	}

	// Assemble req namespace
	rNamespace := vm.NewObject()
	_ = rNamespace.Set("request", rReq)
	_ = rNamespace.Set("response", rResp)
	_ = rNamespace.Set("variables", rVars)
	_ = rNamespace.Set("env", rEnv)
	_ = rNamespace.Set("globals", rGlobals)
	_ = rNamespace.Set("iteration", rIter)
	_ = rNamespace.Set("send", rSend)
	_ = rNamespace.Set("assert", rAssert)
	_ = rNamespace.Set("expect", rExpect)
	_ = rNamespace.Set("log", rLog)

	// reqit namespace (alias)
	rReqit := vm.NewObject()
	_ = rReqit.Set("request", rReq)
	_ = rReqit.Set("response", rResp)
	_ = rReqit.Set("setEnvVar", rVars.Get("set"))
	_ = rReqit.Set("getEnvVar", rVars.Get("get"))
	_ = rReqit.Set("variables", rVars)
	_ = rReqit.Set("env", rEnv)
	_ = rReqit.Set("globals", rGlobals)
	_ = rReqit.Set("iteration", rIter)
	_ = rReqit.Set("send", rSend)
	_ = rReqit.Set("assert", rAssert)
	_ = rReqit.Set("expect", rExpect)
	_ = rReqit.Set("log", rLog)

	_ = vm.Set("req", rNamespace)
	_ = vm.Set("reqit", rReqit)
}

// RunPreScript executes the pre-request script and returns extracted variables, logs, and assertion counts.
func RunPreScript(script string, payload *models.RequestPayload) (vars map[string]string, logs []string, pass, fail int, err error) {
	if strings.TrimSpace(script) == "" {
		return nil, nil, 0, 0, nil
	}

	vm := goja.New()
	varsStore := &VarStore{store: make(map[string]string)}

	reqObj := vm.NewObject()
	_ = reqObj.Set("method", payload.Method)
	_ = reqObj.Set("url", payload.URL)
	_ = reqObj.Set("headers", headersToAPI(payload.Headers))
	_ = reqObj.Set("body", payload.Body)

	pmReq := vm.NewObject()
	_ = pmReq.Set("method", payload.Method)
	_ = pmReq.Set("url", payload.URL)
	_ = pmReq.Set("headers", headersToAPI(payload.Headers))
	_ = pmReq.Set("body", payload.Body)

	pmVars := vm.NewObject()
	_ = pmVars.Set("get", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(varsStore.Get(call.Argument(0).String()))
	})
	_ = pmVars.Set("set", func(call goja.FunctionCall) goja.Value {
		varsStore.Set(call.Argument(0).String(), call.Argument(1).String())
		return goja.Undefined()
	})

	pmObj := vm.NewObject()
	_ = pmObj.Set("request", pmReq)
	_ = pmObj.Set("variables", pmVars)
	_ = vm.Set("pm", pmObj)

	exposeReqNamespace(vm, varsStore, reqObj, nil)

	if _, runErr := runScriptWithTimeout(vm, script); runErr != nil {
		return nil, nil, 0, 0, fmt.Errorf("pre-script error: %w", runErr)
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

	return varsStore.store, varsStore.logs, varsStore.pass, varsStore.fail, nil
}

// RunPostScript executes the post-response script and returns extracted variables, logs, and assertion counts.
func RunPostScript(script string, payload *models.RequestPayload, result *models.ResponseResult) (vars map[string]string, logs []string, pass, fail int, err error) {
	if strings.TrimSpace(script) == "" {
		return nil, nil, 0, 0, nil
	}

	vm := goja.New()
	varsStore := &VarStore{store: make(map[string]string)}

	respObj := vm.NewObject()
	_ = respObj.Set("statusCode", result.StatusCode)
	_ = respObj.Set("statusText", result.Status)
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

	// pm.* namespace for backward compat
	pmResp := vm.NewObject()
	_ = pmResp.Set("status", result.StatusCode)
	_ = pmResp.Set("body", result.Body)
	_ = pmResp.Set("headers", result.Headers)
	_ = pmResp.Set("responseTime", result.TimingMs)
	pmRespJson := func(call goja.FunctionCall) goja.Value {
		var parsed interface{}
		if err := json.Unmarshal([]byte(result.Body), &parsed); err != nil {
			return vm.ToValue(nil)
		}
		return vm.ToValue(parsed)
	}
	_ = pmResp.Set("json", pmRespJson)
	_ = pmResp.Set("text", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(result.Body)
	})

	pmReqPost := vm.NewObject()
	_ = pmReqPost.Set("method", payload.Method)
	_ = pmReqPost.Set("url", payload.URL)
	_ = pmReqPost.Set("body", payload.Body)

	pmVars := vm.NewObject()
	_ = pmVars.Set("get", func(call goja.FunctionCall) goja.Value {
		return vm.ToValue(varsStore.Get(call.Argument(0).String()))
	})
	_ = pmVars.Set("set", func(call goja.FunctionCall) goja.Value {
		varsStore.Set(call.Argument(0).String(), call.Argument(1).String())
		return goja.Undefined()
	})

	pmObj := vm.NewObject()
	_ = pmObj.Set("response", pmResp)
	_ = pmObj.Set("request", pmReqPost)
	_ = pmObj.Set("variables", pmVars)
	_ = vm.Set("pm", pmObj)

	exposeReqNamespace(vm, varsStore, reqObj, respObj)

	if _, runErr := runScriptWithTimeout(vm, script); runErr != nil {
		return nil, nil, 0, 0, fmt.Errorf("post-script error: %w", runErr)
	}

	return varsStore.store, varsStore.logs, varsStore.pass, varsStore.fail, nil
}

type ScriptEnv struct {
	Vars  map[string]string `json:"vars"`
	Logs  []string          `json:"logs"`
	Pass  int               `json:"pass"`
	Fail  int               `json:"fail"`
}

func ExtractVars(source map[string]string) string {
	if len(source) == 0 {
		return "{}"
	}
	b, _ := json.Marshal(source)
	return string(b)
}

func ExtractEnv(env *ScriptEnv) string {
	if env == nil {
		return "{}"
	}
	b, _ := json.Marshal(env)
	return string(b)
}
