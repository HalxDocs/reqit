package mock

import (
	"net/http"
	"testing"
)

func TestRegistrySetGet(t *testing.T) {
	reg := NewRegistry()
	reg.Set("GET", "/users", MockResponse{StatusCode: 200, Body: "ok"})

	resp, ok := reg.Get("GET", "/users")
	if !ok {
		t.Fatal("expected to find route")
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d", resp.StatusCode)
	}
}

func TestRegistryParamMatch(t *testing.T) {
	reg := NewRegistry()
	reg.Set("GET", "/users/:id", MockResponse{StatusCode: 200, Body: "user"})

	resp, ok := reg.Get("GET", "/users/42")
	if !ok {
		t.Fatal("expected param match")
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d", resp.StatusCode)
	}
}

func TestRegistryNoMatch(t *testing.T) {
	reg := NewRegistry()
	_, ok := reg.Get("POST", "/nowhere")
	if ok {
		t.Fatal("should not match empty registry")
	}
}

func TestRulesEngine_Basic(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name:     "admin header",
			Priority: 1,
			Conditions: []Condition{
				{Field: "header", Key: "X-Role", Operator: "eq", Value: "admin"},
			},
			Response: MockResponse{StatusCode: 200, Body: "admin"},
		},
		{
			Name:     "default",
			Priority: 0,
			Response: MockResponse{StatusCode: 401, Body: "unauthorized"},
		},
	})

	resp, ok := re.Evaluate("GET", "/", map[string]string{"X-Role": "admin"}, nil)
	if !ok {
		t.Fatal("expected match")
	}
	if resp.Body != "admin" {
		t.Errorf("body = %v", resp.Body)
	}

	resp2, ok2 := re.Evaluate("GET", "/", map[string]string{}, nil)
	if !ok2 {
		t.Fatal("expected default match")
	}
	if resp2.Body != "unauthorized" {
		t.Errorf("body = %v", resp2.Body)
	}
}

func TestRulesEngine_MethodCondition(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name: "only POST",
			Conditions: []Condition{
				{Field: "method", Operator: "eq", Value: "POST"},
			},
			Response: MockResponse{StatusCode: 201},
		},
	})

	_, ok := re.Evaluate("GET", "/", nil, nil)
	if ok {
		t.Fatal("GET should not match POST-only rule")
	}

	resp, ok := re.Evaluate("POST", "/", nil, nil)
	if !ok {
		t.Fatal("POST should match POST-only rule")
	}
	if resp.StatusCode != 201 {
		t.Errorf("status = %d", resp.StatusCode)
	}
}

func TestRulesEngine_QueryCondition(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Conditions: []Condition{
				{Field: "query", Key: "version", Operator: "eq", Value: "2"},
			},
			Response: MockResponse{StatusCode: 200, Body: "v2"},
		},
	})

	_, ok := re.Evaluate("GET", "/", nil, map[string]string{"version": "1"})
	if ok {
		t.Fatal("should not match version=1")
	}

	resp, ok := re.Evaluate("GET", "/", nil, map[string]string{"version": "2"})
	if !ok {
		t.Fatal("should match version=2")
	}
	if resp.Body != "v2" {
		t.Errorf("body = %v", resp.Body)
	}
}

func TestRulesEngine_ContainsCondition(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Conditions: []Condition{
				{Field: "path", Operator: "contains", Value: "admin"},
			},
			Response: MockResponse{StatusCode: 200},
		},
	})

	_, ok := re.Evaluate("GET", "/users", nil, nil)
	if ok {
		t.Fatal("should not match /users")
	}

	_, ok = re.Evaluate("GET", "/admin/dashboard", nil, nil)
	if !ok {
		t.Fatal("should match /admin/dashboard")
	}
}

func TestStateStore(t *testing.T) {
	ss := NewStateStore()
	if ss.Get("/api/test") != 0 {
		t.Error("initial count should be 0")
	}
	c1 := ss.Next("/api/test")
	if c1 != 1 {
		t.Errorf("first call = %d", c1)
	}
	c2 := ss.Next("/api/test")
	if c2 != 2 {
		t.Errorf("second call = %d", c2)
	}
}

func TestStateStoreSession(t *testing.T) {
	ss := NewStateStore()
	s1 := ss.SessionNext("sess-a", "/api/check")
	if s1 != 1 {
		t.Errorf("sess-a first = %d", s1)
	}
	s2 := ss.SessionNext("sess-b", "/api/check")
	if s2 != 1 {
		t.Errorf("sess-b first = %d", s2)
	}
	s3 := ss.SessionNext("sess-a", "/api/check")
	if s3 != 2 {
		t.Errorf("sess-a second = %d", s3)
	}
}

func TestStateStoreReset(t *testing.T) {
	ss := NewStateStore()
	ss.Next("/api/reset-test")
	ss.Next("/api/reset-test")
	ss.Reset("/api/reset-test")
	if ss.Get("/api/reset-test") != 0 {
		t.Error("count should be 0 after reset")
	}
}

func TestMockVariables(t *testing.T) {
	result := MockVariables("{{$guid}}")
	if result == "{{$guid}}" {
		t.Error("guid was not replaced")
	}

	ts := MockVariables("{{$timestamp}}")
	if ts == "{{$timestamp}}" {
		t.Error("timestamp was not replaced")
	}

	ri := MockVariables("{{$randomInt}}")
	if ri == "{{$randomInt}}" {
		t.Error("randomInt was not replaced")
	}

	mixed := MockVariables("prefix-{{$guid}}-suffix")
	if mixed == "prefix-{{$guid}}-suffix" {
		t.Error("mixed variable was not replaced")
	}
}

func TestParseQueryParams(t *testing.T) {
	m := ParseQueryParams("a=1&b=hello&c")
	if m["a"] != "1" {
		t.Errorf("a = %q", m["a"])
	}
	if m["b"] != "hello" {
		t.Errorf("b = %q", m["b"])
	}
	if _, ok := m["c"]; ok {
		t.Error("c should not be present (no value)")
	}
}

func TestMatchPath(t *testing.T) {
	tests := []struct {
		pattern, actual string
		want            bool
	}{
		{"/users/:id", "/users/42", true},
		{"/users/:id", "/users/42/profile", false},
		{"/users/:id/items", "/users/42/items", true},
		{"/users/:id", "/admins/42", false},
		{"/", "/", true},
		{"/static", "/static", true},
	}
	for _, tc := range tests {
		got := matchPath(tc.pattern, tc.actual)
		if got != tc.want {
			t.Errorf("matchPath(%q, %q) = %v, want %v", tc.pattern, tc.actual, got, tc.want)
		}
	}
}

func TestRecordingSink(t *testing.T) {
	reg := NewRegistry()
	rs := NewRecordingSink(reg)

	if rs.Enabled() {
		t.Error("should be disabled by default")
	}
	rs.Enable()
	if !rs.Enabled() {
		t.Error("should be enabled")
	}

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       http.NoBody,
	}
	if err := rs.Record("GET", "/recorded", resp); err != nil {
		t.Fatal(err)
	}

	mr, ok := reg.Get("GET", "/recorded")
	if !ok {
		t.Fatal("recorded route not found")
	}
	if mr.StatusCode != 200 {
		t.Errorf("status = %d", mr.StatusCode)
	}
}

func TestRecordingSink_Disabled(t *testing.T) {
	reg := NewRegistry()
	rs := NewRecordingSink(reg)

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{},
		Body:       http.NoBody,
	}

	rs.Record("POST", "/secret", resp)
	if reg.Count() != 0 {
		t.Error("should not record when disabled")
	}
}
