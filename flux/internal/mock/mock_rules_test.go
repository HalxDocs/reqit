package mock

import (
	"testing"
)

// The rules engine is evaluated before the static route registry, so a rule
// decides the response for a request the routes also match.
func TestRuleMatchesOnMethod(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name:     "posts fail",
			Priority: 10,
			Conditions: []Condition{
				{Field: "method", Operator: "eq", Value: "POST"},
			},
			Response: MockResponse{StatusCode: 500, Body: "boom"},
		},
	})

	if _, ok := re.Evaluate("POST", "/users", nil, nil); !ok {
		t.Fatal("expected the rule to match a POST")
	}
	if _, ok := re.Evaluate("GET", "/users", nil, nil); ok {
		t.Fatal("expected the rule not to match a GET")
	}
}

func TestRuleMatchesOnHeader(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name: "debug",
			Conditions: []Condition{
				{Field: "header", Key: "X-Debug", Operator: "eq", Value: "1"},
			},
			Response: MockResponse{StatusCode: 200, Body: "debug"},
		},
	})

	if _, ok := re.Evaluate("GET", "/x", map[string]string{"X-Debug": "1"}, nil); !ok {
		t.Fatal("expected the rule to match the header")
	}
	if _, ok := re.Evaluate("GET", "/x", map[string]string{"X-Debug": "0"}, nil); ok {
		t.Fatal("expected the rule not to match a different header value")
	}
	if _, ok := re.Evaluate("GET", "/x", nil, nil); ok {
		t.Fatal("expected the rule not to match when the header is absent")
	}
}

func TestRuleMatchesOnQuery(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name: "not found",
			Conditions: []Condition{
				{Field: "query", Key: "id", Operator: "eq", Value: "404"},
			},
			Response: MockResponse{StatusCode: 404},
		},
	})

	if _, ok := re.Evaluate("GET", "/x", nil, map[string]string{"id": "404"}); !ok {
		t.Fatal("expected the rule to match the query parameter")
	}
	if _, ok := re.Evaluate("GET", "/x", nil, map[string]string{"id": "1"}); ok {
		t.Fatal("expected the rule not to match a different value")
	}
}

func TestRuleRequiresEveryCondition(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name: "both",
			Conditions: []Condition{
				{Field: "method", Operator: "eq", Value: "POST"},
				{Field: "path", Operator: "contains", Value: "/admin"},
			},
			Response: MockResponse{StatusCode: 403},
		},
	})

	if _, ok := re.Evaluate("POST", "/admin/users", nil, nil); !ok {
		t.Fatal("expected both conditions to be satisfied")
	}
	if _, ok := re.Evaluate("POST", "/users", nil, nil); ok {
		t.Fatal("expected no match when only one condition holds")
	}
	if _, ok := re.Evaluate("GET", "/admin/users", nil, nil); ok {
		t.Fatal("expected no match when only one condition holds")
	}
}

func TestHigherPriorityRuleWins(t *testing.T) {
	re := NewRulesEngine([]Rule{
		{
			Name:       "low",
			Priority:   1,
			Conditions: []Condition{{Field: "method", Operator: "eq", Value: "GET"}},
			Response:   MockResponse{StatusCode: 200, Body: "low"},
		},
		{
			Name:       "high",
			Priority:   10,
			Conditions: []Condition{{Field: "method", Operator: "eq", Value: "GET"}},
			Response:   MockResponse{StatusCode: 503, Body: "high"},
		},
	})

	resp, ok := re.Evaluate("GET", "/x", nil, nil)
	if !ok {
		t.Fatal("expected a match")
	}
	if resp.StatusCode != 503 {
		t.Errorf("expected the higher priority rule to win, got status %d", resp.StatusCode)
	}
}

func TestNoRulesMatchesNothing(t *testing.T) {
	re := NewRulesEngine(nil)
	if _, ok := re.Evaluate("GET", "/x", nil, nil); ok {
		t.Fatal("expected no match with no rules")
	}
}

func TestRulesReturnsTheConfiguredRules(t *testing.T) {
	rules := []Rule{{Name: "one"}}
	s := &MockServer{rules: NewRulesEngine(rules)}
	got := s.Rules()
	if len(got) != 1 || got[0].Name != "one" {
		t.Errorf("Rules() = %+v", got)
	}
}
