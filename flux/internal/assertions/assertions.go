package assertions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/dop251/goja"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"flux/internal/models"
)

type Context struct {
	Response   models.ResponseResult
	Variables  map[string]string
	BodyJSON   interface{}
	BodyParsed bool
}

func Evaluate(req models.RunnerRequest, resp models.ResponseResult, env map[string]string) []string {
	ctx := &Context{
		Response:  resp,
		Variables: env,
	}

	var errs []string

	for _, a := range req.Assertions {
		if err := evaluateOne(ctx, a); err != "" {
			errs = append(errs, err)
		}
	}

	return errs
}

// EvaluateLegacy handles the old-style assertion struct for backward compat.
func EvaluateLegacy(resp models.ResponseResult, a models.Assertion) []string {
	var errs []string

	if a.StatusCode > 0 && resp.StatusCode != a.StatusCode {
		errs = append(errs, fmt.Sprintf("expected status %d, got %d", a.StatusCode, resp.StatusCode))
	}

	if a.MaxTimingMs > 0 && resp.TimingMs > a.MaxTimingMs {
		errs = append(errs, fmt.Sprintf("response too slow: %dms (max %dms)", resp.TimingMs, a.MaxTimingMs))
	}

	if a.BodyContains != "" && !strings.Contains(resp.Body, a.BodyContains) {
		errs = append(errs, fmt.Sprintf("body does not contain %q", a.BodyContains))
	}

	if a.Type != "" {
		ctx := &Context{Response: resp}
		if err := evaluateOne(ctx, a); err != "" {
			errs = append(errs, err)
		}
	}

	return errs
}

func evaluateOne(ctx *Context, a models.Assertion) string {
	switch a.Type {
	case models.AssertBodyMatch:
		re, err := regexp.Compile(a.Target)
		if err != nil {
			return fmt.Sprintf("invalid regex %q: %v", a.Target, err)
		}
		if !re.MatchString(ctx.Response.Body) {
			return fmt.Sprintf("body does not match regex %q", a.Target)
		}

	case models.AssertBodyNotMatch:
		re, err := regexp.Compile(a.Target)
		if err != nil {
			return fmt.Sprintf("invalid regex %q: %v", a.Target, err)
		}
		if re.MatchString(ctx.Response.Body) {
			return fmt.Sprintf("body matches regex %q but should not", a.Target)
		}

	case models.AssertJSONPath:
		val, err := extractJSONPath(ctx.Response.Body, a.Target)
		if err != nil {
			return fmt.Sprintf("jsonPath %q: %v", a.Target, err)
		}
		if val != a.Value {
			return fmt.Sprintf("jsonPath %q expected %q, got %q", a.Target, a.Value, val)
		}

	case models.AssertHeader:
		val := ctx.Response.Headers[http.CanonicalHeaderKey(a.Target)]
		if val == "" {
			val = ctx.Response.Headers[a.Target]
		}
		if a.Value != "" && !strings.EqualFold(val, a.Value) {
			return fmt.Sprintf("header %q expected %q, got %q", a.Target, a.Value, val)
		}
		if a.Value == "" && val == "" {
			return fmt.Sprintf("header %q not present", a.Target)
		}

	case models.AssertCookie:
		found := false
		for _, c := range ctx.Response.Cookies {
			if strings.EqualFold(c.Name, a.Target) {
				found = true
				if a.Value != "" && c.Value != a.Value {
					return fmt.Sprintf("cookie %q expected %q, got %q", a.Target, a.Value, c.Value)
				}
				break
			}
		}
		if !found {
			return fmt.Sprintf("cookie %q not present", a.Target)
		}

	case models.AssertVarEqual:
		lhs, lok := ctx.Variables[a.Target]
		rhs, rok := ctx.Variables[a.Value]
		if !lok || !rok {
			return fmt.Sprintf("variable comparison: %q or %q not found", a.Target, a.Value)
		}
		if lhs != rhs {
			return fmt.Sprintf("variable %q (%s) != %q (%s)", a.Target, lhs, a.Value, rhs)
		}

	case models.AssertVarNotEqual:
		lhs, lok := ctx.Variables[a.Target]
		rhs, rok := ctx.Variables[a.Value]
		if !lok || !rok {
			return fmt.Sprintf("variable comparison: %q or %q not found", a.Target, a.Value)
		}
		if lhs == rhs {
			return fmt.Sprintf("variable %q (%s) == %q (%s)", a.Target, lhs, a.Value, rhs)
		}

	case models.AssertJSONSchema:
		if err := validateJSONSchema(ctx.Response.Body, a.Target); err != "" {
			return fmt.Sprintf("JSON Schema: %s", err)
		}

	case models.AssertCustomScript:
		if err := runCustomScript(ctx, a.Script); err != "" {
			return fmt.Sprintf("custom script: %s", err)
		}
	}

	return ""
}

func extractJSONPath(body, path string) (string, error) {
	var v interface{}
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return "", fmt.Errorf("invalid JSON: %w", err)
	}
	parts := strings.Split(path, ".")
	current := v
	for _, part := range parts {
		m, ok := current.(map[string]interface{})
		if !ok {
			return "", fmt.Errorf("cannot navigate into %T at %q", current, part)
		}
		current, ok = m[part]
		if !ok {
			return "", fmt.Errorf("key %q not found", part)
		}
	}
	return fmt.Sprintf("%v", current), nil
}

func validateJSONSchema(body, schemaJSON string) string {
	if strings.TrimSpace(schemaJSON) == "" {
		return ""
	}

	var doc interface{}
	if err := json.Unmarshal([]byte(body), &doc); err != nil {
		return fmt.Sprintf("invalid JSON body: %v", err)
	}

	var schemaDoc interface{}
	if err := json.Unmarshal([]byte(schemaJSON), &schemaDoc); err != nil {
		return fmt.Sprintf("invalid schema JSON: %v", err)
	}

	c := jsonschema.NewCompiler()
	if err := c.AddResource("schema.json", schemaDoc); err != nil {
		return fmt.Sprintf("compiler error: %v", err)
	}

	sch, err := c.Compile("schema.json")
	if err != nil {
		return fmt.Sprintf("compile error: %v", err)
	}

	if err := sch.Validate(doc); err != nil {
		return fmt.Sprintf("validation failed: %v", err)
	}

	return ""
}

func runCustomScript(ctx *Context, script string) string {
	if strings.TrimSpace(script) == "" {
		return "empty script"
	}

	vm := goja.New()

	_ = vm.Set("response", map[string]interface{}{
		"status":     ctx.Response.StatusCode,
		"body":       ctx.Response.Body,
		"headers":    ctx.Response.Headers,
		"responseTime": ctx.Response.TimingMs,
	})

	vars := vm.NewObject()
	for k, v := range ctx.Variables {
		_ = vars.Set(k, v)
	}
	_ = vm.Set("variables", vars)

	var assertionResult bool
	_ = vm.Set("assert", func(cond bool, msg string) {
		if !cond {
			panic(msg)
		}
		assertionResult = true
	})

	_ = vm.Set("expect", func(val interface{}) *expectWrapper {
		return &expectWrapper{vm: vm, val: val}
	})

	var scriptErr error
	func() {
		defer func() {
			if r := recover(); r != nil {
				scriptErr = fmt.Errorf("script panic: %v", r)
			}
		}()
		_, err := vm.RunString(script)
		if err != nil {
			scriptErr = fmt.Errorf("script error: %v", err)
		}
	}()
	if scriptErr != nil {
		return scriptErr.Error()
	}

	_ = assertionResult
	return ""
}

type expectWrapper struct {
	vm  *goja.Runtime
	val interface{}
}

func (e *expectWrapper) ToEqual(expected interface{}) {
	if fmt.Sprintf("%v", e.val) != fmt.Sprintf("%v", expected) {
		panic(fmt.Sprintf("expected %v, got %v", expected, e.val))
	}
}

func (e *expectWrapper) ToNotEqual(expected interface{}) {
	if fmt.Sprintf("%v", e.val) == fmt.Sprintf("%v", expected) {
		panic(fmt.Sprintf("expected not %v", expected))
	}
}

func (e *expectWrapper) ToContain(substr string) {
	s := fmt.Sprintf("%v", e.val)
	if !strings.Contains(s, substr) {
		panic(fmt.Sprintf("expected %q to contain %q", s, substr))
	}
}

func (e *expectWrapper) ToMatch(pattern string) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		panic(fmt.Sprintf("invalid regex %q: %v", pattern, err))
	}
	s := fmt.Sprintf("%v", e.val)
	if !re.MatchString(s) {
		panic(fmt.Sprintf("expected %q to match %q", s, pattern))
	}
}
