package mock

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Condition defines a predicate evaluated against an incoming request.
type Condition struct {
	Field    string `json:"field"`    // "header", "query", "method", "path"
	Key      string `json:"key"`      // header name, query param name, or "" for method/path
	Operator string `json:"operator"` // "eq", "neq", "contains", "matches", "exists"
	Value    string `json:"value"`
}

// Rule couples one or more conditions with a response.
type Rule struct {
	Name       string       `json:"name"`
	Priority   int          `json:"priority"` // higher = evaluated first
	Conditions []Condition  `json:"conditions"`
	Response   MockResponse `json:"response"`
}

// RulesEngine evaluates rules in priority order and returns the first match.
type RulesEngine struct {
	rules []Rule
}

func NewRulesEngine(rules []Rule) *RulesEngine {
	// Evaluate the highest priority first. The sort is stable, so rules that
	// share a priority keep the order they were given in.
	ordered := make([]Rule, len(rules))
	copy(ordered, rules)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].Priority > ordered[j].Priority
	})
	return &RulesEngine{rules: ordered}
}

func (re *RulesEngine) Evaluate(method, path string, headers map[string]string, queryParams map[string]string) (MockResponse, bool) {
	for _, rule := range re.rules {
		if rule.evaluate(method, path, headers, queryParams) {
			return rule.Response, true
		}
	}
	return MockResponse{}, false
}

func (r *Rule) evaluate(method, path string, headers, queryParams map[string]string) bool {
	for _, c := range r.Conditions {
		if !c.evaluate(method, path, headers, queryParams) {
			return false
		}
	}
	return true
}

func (c *Condition) evaluate(method, path string, headers, queryParams map[string]string) bool {
	switch c.Field {
	case "method":
		return compare(c.Operator, strings.ToUpper(method), strings.ToUpper(c.Value))
	case "path":
		return compare(c.Operator, path, c.Value)
	case "header":
		return compare(c.Operator, headers[c.Key], c.Value)
	case "query":
		return compare(c.Operator, queryParams[c.Key], c.Value)
	}
	return false
}

func compare(op, actual, expected string) bool {
	switch op {
	case "eq":
		return actual == expected
	case "neq":
		return actual != expected
	case "contains":
		return strings.Contains(actual, expected)
	case "matches":
		matched, _ := regexp.MatchString(expected, actual)
		return matched
	case "exists":
		return actual != ""
	}
	return false
}

// RuleMarshaller helps serialise rules to/from JSON for the frontend.
type RuleDef struct {
	Name       string      `json:"name"`
	Priority   int         `json:"priority"`
	Conditions []Condition `json:"conditions"`
	Response   struct {
		StatusCode int               `json:"statusCode"`
		Headers    map[string]string `json:"headers"`
		Body       string            `json:"body"`
		DelayMs    int               `json:"delayMs"`
	} `json:"response"`
}

func (r *RuleDef) ToRule() Rule {
	return Rule{
		Name:       r.Name,
		Priority:   r.Priority,
		Conditions: r.Conditions,
		Response: MockResponse{
			StatusCode: r.Response.StatusCode,
			Headers:    r.Response.Headers,
			Body:       r.Response.Body,
			DelayMs:    r.Response.DelayMs,
		},
	}
}

// ParseQueryParams extracts query params from a raw URL query string.
func ParseQueryParams(rawQuery string) map[string]string {
	out := make(map[string]string)
	for _, pair := range strings.Split(rawQuery, "&") {
		if kv := strings.SplitN(pair, "=", 2); len(kv) == 2 {
			out[kv[0]] = kv[1]
		}
	}
	return out
}

// ErrNoMatch is returned when no rule matches.
var ErrNoMatch = fmt.Errorf("no matching rule")
