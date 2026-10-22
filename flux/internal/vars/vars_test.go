package vars

import (
	"testing"

	"flux/internal/models"
)

func TestResolve(t *testing.T) {
	env := map[string]string{"host": "api.example.com", "token": "abc"}

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain text is untouched", "hello", "hello"},
		{"simple placeholder", "https://{{host}}/users", "https://api.example.com/users"},
		{"whitespace inside the placeholder", "https://{{ host }}/users", "https://api.example.com/users"},
		{"several placeholders", "{{host}}/{{host}}", "api.example.com/api.example.com"},
		{"unknown placeholder is left alone", "{{missing}}", "{{missing}}"},
		{"text around the placeholder", "Bearer {{token}} done", "Bearer abc done"},
		{"empty environment leaves the text alone", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := Resolve(tc.in, env, nil); got != tc.want {
				t.Errorf("Resolve(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestResolveUsesTheFallbackForUnknownNames(t *testing.T) {
	fallback := func(name string) (string, bool) {
		if name == "faker.name" {
			return "Alice", true
		}
		return "", false
	}
	got := Resolve("{{faker.name}}", map[string]string{}, fallback)
	if got != "Alice" {
		t.Errorf("Resolve = %q, want %q", got, "Alice")
	}
}

func TestResolvePayload(t *testing.T) {
	env := map[string]string{"host": "api.example.com"}
	p := models.RequestPayload{
		URL:       "https://{{host}}/users",
		Body:      `{"id":"{{host}}"}`,
		AuthValue: "Bearer {{host}}",
		Headers: []models.Header{
			{Key: "X-Enabled", Value: "{{host}}", Enabled: true},
			{Key: "X-Disabled", Value: "{{host}}", Enabled: false},
		},
		Params: []models.Header{
			{Key: "q", Value: "{{host}}", Enabled: true},
		},
		BodyForm: []models.Header{
			{Key: "f", Value: "{{host}}", Enabled: true},
		},
	}

	got := ResolvePayload(p, env, nil)

	if got.URL != "https://api.example.com/users" {
		t.Errorf("URL = %q", got.URL)
	}
	if got.Body != `{"id":"api.example.com"}` {
		t.Errorf("Body = %q", got.Body)
	}
	if got.AuthValue != "Bearer api.example.com" {
		t.Errorf("AuthValue = %q", got.AuthValue)
	}
	if got.Headers[0].Value != "api.example.com" {
		t.Errorf("enabled header = %q", got.Headers[0].Value)
	}
	// A disabled header must keep its placeholder.
	if got.Headers[1].Value != "{{host}}" {
		t.Errorf("disabled header = %q, want the placeholder untouched", got.Headers[1].Value)
	}
	if got.Params[0].Value != "api.example.com" {
		t.Errorf("param = %q", got.Params[0].Value)
	}
	if got.BodyForm[0].Value != "api.example.com" {
		t.Errorf("form field = %q", got.BodyForm[0].Value)
	}
}

func TestHasVars(t *testing.T) {
	if HasVars("https://x.test", "", "", nil, nil, nil) {
		t.Error("expected no variables")
	}
	if !HasVars("https://{{host}}/x", "", "", nil, nil, nil) {
		t.Error("expected a variable in the URL")
	}
	if !HasVars("", "", "", []models.Header{{Value: "{{a}}", Enabled: true}}, nil, nil) {
		t.Error("expected a variable in an enabled header")
	}
	if HasVars("", "", "", []models.Header{{Value: "{{a}}", Enabled: false}}, nil, nil) {
		t.Error("a disabled header does not count")
	}
}
