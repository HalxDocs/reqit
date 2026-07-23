package openapi

import (
	"path/filepath"
	"testing"
)

func TestNewSpecDesign(t *testing.T) {
	sd := NewSpecDesign("Test API", "2.0.0")
	if sd.doc.Info.Title != "Test API" {
		t.Errorf("title = %q", sd.doc.Info.Title)
	}
	if sd.doc.Info.Version != "2.0.0" {
		t.Errorf("version = %q", sd.doc.Info.Version)
	}
	if len(sd.Endpoints()) != 0 {
		t.Error("Endpoints() should be empty for fresh spec")
	}
}

func TestAddEndpoint(t *testing.T) {
	sd := NewSpecDesign("Test", "1.0")
	sd.AddEndpoint("GET", "/users", "List users")
	sd.AddEndpoint("POST", "/users", "Create user")

	eps := sd.Endpoints()
	if len(eps) != 2 {
		t.Fatalf("got %d endpoints, want 2", len(eps))
	}
	if eps[0].Method != "GET" || eps[0].Path != "/users" {
		t.Errorf("first endpoint = %s %s", eps[0].Method, eps[0].Path)
	}
}

func TestRemoveEndpoint(t *testing.T) {
	sd := NewSpecDesign("Test", "1.0")
	sd.AddEndpoint("GET", "/items", "")
	sd.AddEndpoint("POST", "/items", "")
	sd.RemoveEndpoint("GET", "/items")

	eps := sd.Endpoints()
	if len(eps) != 1 {
		t.Fatalf("got %d endpoints after remove, want 1", len(eps))
	}
	if eps[0].Method != "POST" {
		t.Errorf("remaining = %s, want POST", eps[0].Method)
	}
}

func TestRemoveLastEndpoint(t *testing.T) {
	sd := NewSpecDesign("Test", "1.0")
	sd.AddEndpoint("GET", "/items", "")
	sd.RemoveEndpoint("GET", "/items")

	eps := sd.Endpoints()
	if len(eps) != 0 {
		t.Errorf("got %d endpoints, want 0", len(eps))
	}
	// The path should be removed entirely
	if sd.doc.Paths.Value("/items") != nil {
		t.Error("path should be removed when no methods remain")
	}
}

func TestSetEndpointDescription(t *testing.T) {
	sd := NewSpecDesign("Test", "1.0")
	sd.AddEndpoint("GET", "/status", "Health")
	sd.SetEndpointDescription("GET", "/status", "Health check", "Returns 200 OK")

	eps := sd.Endpoints()
	if len(eps) != 1 {
		t.Fatalf("got %d endpoints", len(eps))
	}
	if eps[0].Summary != "Health check" {
		t.Errorf("summary = %q", eps[0].Summary)
	}
}

func TestSaveAndReload(t *testing.T) {
	dir := t.TempDir()
	specPath := filepath.Join(dir, "test-spec.json")

	sd := NewSpecDesign("SaveTest", "1.0")
	sd.AddEndpoint("GET", "/ping", "Ping")
	sd.path = specPath
	if _, err := sd.Save(); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadSpecDesign(specPath)
	if err != nil {
		t.Fatal(err)
	}
	eps := loaded.Endpoints()
	if len(eps) != 1 {
		t.Fatalf("got %d endpoints after reload", len(eps))
	}
	if eps[0].Method != "GET" || eps[0].Path != "/ping" {
		t.Errorf("endpoint = %s %s", eps[0].Method, eps[0].Path)
	}
}

func TestQueryParams(t *testing.T) {
	sd := NewSpecDesign("Test", "1.0")
	sd.AddEndpoint("GET", "/search", "Search")
	sd.AddQueryParam("GET", "/search", "q", true, "string")
	sd.AddQueryParam("GET", "/search", "page", false, "integer")

	eps := sd.Endpoints()
	if len(eps) != 1 {
		t.Fatalf("got %d endpoints", len(eps))
	}
}

func TestSlugify(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Hello World", "hello-world"},
		{"GET /users/{id}", "get--users-id"},
		{"MyAPI-V2", "myapi-v2"},
	}
	for _, c := range cases {
		got := slugify(c.in)
		if got != c.want {
			t.Errorf("slugify(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
