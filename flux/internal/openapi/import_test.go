package openapi

import (
	"os"
	"path/filepath"
	"testing"
)

func TestImport(t *testing.T) {
	dir := t.TempDir()
	spec := filepath.Join(dir, "petstore.yaml")
	specContent := `openapi: "3.0.3"
info:
  title: Petstore
  version: "1.0"
paths:
  /pets:
    get:
      tags: [Pets]
      summary: List all pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: OK
    post:
      tags: [Pets]
      summary: Create a pet
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        "201":
          description: Created
  /pets/{petId}:
    get:
      tags: [Pets]
      summary: Get pet by ID
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
`
	if err := os.WriteFile(spec, []byte(specContent), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := Import(spec)
	if err != nil {
		t.Fatal(err)
	}
	if result.SpecTitle != "Petstore" {
		t.Errorf("title = %q, want Petstore", result.SpecTitle)
	}
	if result.Endpoints != 3 {
		t.Errorf("endpoints = %d, want 3", result.Endpoints)
	}
	if len(result.Collections) != 1 {
		t.Fatalf("collections = %d, want 1", len(result.Collections))
	}
	reqs := result.Collections[0].Requests
	if len(reqs) != 3 {
		t.Fatalf("requests = %d, want 3", len(reqs))
	}
	methods := map[string]int{}
	for _, r := range reqs {
		methods[r.Payload.Method]++
	}
	if methods["GET"] != 2 || methods["POST"] != 1 {
		t.Errorf("methods = %v, want GET:2 POST:1", methods)
	}
}

func TestImport_NoPaths(t *testing.T) {
	dir := t.TempDir()
	spec := filepath.Join(dir, "empty.yaml")
	os.WriteFile(spec, []byte(`openapi: "3.0.3"
info:
  title: Empty
  version: "1.0"
paths: {}
`), 0644)

	_, err := Import(spec)
	if err == nil {
		t.Fatal("expected error for empty paths")
	}
}

func TestImport_InvalidYAML(t *testing.T) {
	dir := t.TempDir()
	spec := filepath.Join(dir, "bad.yaml")
	os.WriteFile(spec, []byte(`{invalid`), 0644)

	_, err := Import(spec)
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}
