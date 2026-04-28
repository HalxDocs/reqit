package postman

import "testing"

const v21Sample = `{
  "info": {"name": "Demo", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "item": [
    {
      "name": "Folder",
      "item": [
        {
          "name": "Get user",
          "request": {
            "method": "GET",
            "header": [{"key": "X-Test", "value": "abc"}],
            "url": {"raw": "https://api.example.com/users", "query": [{"key": "id", "value": "1"}]}
          }
        }
      ]
    },
    {
      "name": "Create user",
      "request": {
        "method": "POST",
        "header": [],
        "body": {"mode": "raw", "raw": "{\"name\":\"alice\"}"},
        "url": "https://api.example.com/users",
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "abc"}]}
      }
    }
  ]
}`

func TestParse_NestedFoldersAndModes(t *testing.T) {
	saved, err := Parse([]byte(v21Sample), "coll-1")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if len(saved) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(saved))
	}

	get := saved[0]
	if get.Name != "Folder / Get user" {
		t.Errorf("expected nested name, got %q", get.Name)
	}
	if get.Payload.Method != "GET" {
		t.Errorf("expected GET, got %q", get.Payload.Method)
	}
	if get.Payload.URL != "https://api.example.com/users" {
		t.Errorf("expected URL, got %q", get.Payload.URL)
	}
	if len(get.Payload.Params) != 1 || get.Payload.Params[0].Key != "id" {
		t.Errorf("expected id query param, got %+v", get.Payload.Params)
	}
	if len(get.Payload.Headers) != 1 || get.Payload.Headers[0].Key != "X-Test" {
		t.Errorf("expected X-Test header, got %+v", get.Payload.Headers)
	}

	post := saved[1]
	if post.Payload.Method != "POST" {
		t.Errorf("expected POST, got %q", post.Payload.Method)
	}
	if post.Payload.BodyType != "json" {
		t.Errorf("expected json body type, got %q", post.Payload.BodyType)
	}
	if post.Payload.Body != `{"name":"alice"}` {
		t.Errorf("unexpected raw body: %q", post.Payload.Body)
	}
	if post.Payload.AuthType != "bearer" || post.Payload.AuthValue != "abc" {
		t.Errorf("expected bearer auth abc, got %q / %q", post.Payload.AuthType, post.Payload.AuthValue)
	}
}

func TestParse_EmptyInput(t *testing.T) {
	if _, err := Parse(nil, "x"); err == nil {
		t.Fatal("expected error for empty input")
	}
}
