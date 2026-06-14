package markdown

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"flux/internal/models"
)

func TestGenerateEmptyCollection(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{Name: "Empty API", Requests: nil}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "# Empty API") {
		t.Error("missing H1")
	}
	if !strings.Contains(out, "_No requests found._") {
		t.Error("missing empty-state note")
	}
}

func TestGenerateSingleRequest(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{
		Name: "Test API",
		Requests: []models.SavedRequest{
			{
				Name: "Get Users",
				Payload: models.RequestPayload{
					Method: "GET",
					URL:    "https://api.example.com/users",
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "### Get Users") {
		t.Error("missing H3 request name")
	}
	if !strings.Contains(out, "`GET`") {
		t.Error("missing method")
	}
	if !strings.Contains(out, "`https://api.example.com/users`") {
		t.Error("missing URL")
	}
}

func TestGenerateHeaders(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{
		Name: "H API",
		Requests: []models.SavedRequest{
			{
				Name: "Auth",
				Payload: models.RequestPayload{
					Method: "POST",
					URL:    "/auth",
					Headers: []models.Header{
						{Key: "Authorization", Value: "Bearer tok", Enabled: true},
						{Key: "X-Disabled", Value: "no", Enabled: false},
					},
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "#### Headers") {
		t.Error("missing Headers section")
	}
	if !strings.Contains(out, "Authorization") {
		t.Error("missing enabled header")
	}
	if strings.Contains(out, "X-Disabled") {
		t.Error("disabled header should be omitted")
	}
	if !strings.Contains(out, "| Key | Value | Required |") {
		t.Error("missing table header")
	}
}

func TestGenerateBodyJSON(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{
		Name: "B API",
		Requests: []models.SavedRequest{
			{
				Name: "Create",
				Payload: models.RequestPayload{
					Method:   "POST",
					URL:      "/items",
					BodyType: "json",
					Body:     `{"name":"test"}`,
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "#### Request Body") {
		t.Error("missing body section")
	}
	if !strings.Contains(out, "```json") {
		t.Error("missing json fenced block")
	}
	if !strings.Contains(out, `{"name":"test"}`) {
		t.Error("missing body content")
	}
}

func TestGenerateBodyEmpty(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{
		Name: "No Body",
		Requests: []models.SavedRequest{
			{
				Name: "Empty",
				Payload: models.RequestPayload{
					Method:   "GET",
					URL:      "/health",
					BodyType: "none",
					Body:     "",
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "#### Request Body") {
		t.Error("body section should be omitted for empty body")
	}
}

func TestGenerateExample(t *testing.T) {
	g := New(DefaultOptions())
	col := &models.Collection{
		Name: "Ex API",
		Requests: []models.SavedRequest{
			{
				Name: "Get",
				Payload: models.RequestPayload{
					Method: "GET",
					URL:    "/data",
				},
				SavedResponse: &models.SavedResponse{
					StatusCode: 200,
					Body:       `{"ok":true}`,
					Headers:    map[string]string{"content-type": "application/json"},
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "#### Example Response") {
		t.Error("missing example section")
	}
	if !strings.Contains(out, "**Status:** 200") {
		t.Error("missing status")
	}
	if !strings.Contains(out, "`content-type`") {
		t.Error("missing response header")
	}
}

func TestGenerateTimestamp(t *testing.T) {
	opts := DefaultOptions()
	opts.Timestamp = true
	g := New(opts)
	col := &models.Collection{Name: "TS", Requests: nil}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "_Generated:") {
		t.Error("missing timestamp line")
	}
	if !strings.Contains(out, time.Now().UTC().Format("2006")) {
		t.Error("timestamp should include current year")
	}
}

func TestGenerateNoTimestamp(t *testing.T) {
	opts := DefaultOptions()
	opts.Timestamp = false
	g := New(opts)
	col := &models.Collection{Name: "NoTS", Requests: nil}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "_Generated:") {
		t.Error("timestamp should be absent")
	}
}

func TestGenerateBaseURL(t *testing.T) {
	opts := DefaultOptions()
	opts.BaseURL = "https://staging.example.com"
	g := New(opts)
	col := &models.Collection{Name: "Base", Requests: nil}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "**Base URL:** `https://staging.example.com`") {
		t.Error("missing base URL")
	}
}

func TestGenerateLargeCollection(t *testing.T) {
	g := New(DefaultOptions())
	reqs := make([]models.SavedRequest, 500)
	for i := range reqs {
		reqs[i] = models.SavedRequest{
			Name: fmt.Sprintf("Req %d", i),
			Payload: models.RequestPayload{
				Method: "GET",
				URL:    fmt.Sprintf("/item/%d", i),
				Headers: []models.Header{
					{Key: "X-ID", Value: fmt.Sprintf("%d", i), Enabled: true},
				},
				BodyType: "json",
				Body:     `{"id":` + fmt.Sprintf("%d", i) + `}`,
			},
		}
	}
	col := &models.Collection{Name: "Large", Requests: reqs}
	start := time.Now()
	out, err := g.Generate(col)
	dur := time.Since(start)
	if err != nil {
		t.Fatal(err)
	}
	if dur > 200*time.Millisecond {
		t.Errorf("export took %v, want <200ms", dur)
	}
	if !strings.Contains(out, "# Large") {
		t.Error("missing H1")
	}
	if !strings.Contains(out, "Req 499") {
		t.Error("missing last request")
	}
}

func TestHeaderValueTruncation(t *testing.T) {
	g := New(DefaultOptions())
	longVal := strings.Repeat("a", 100)
	col := &models.Collection{
		Name: "Trunc",
		Requests: []models.SavedRequest{
			{
				Name: "T",
				Payload: models.RequestPayload{
					Method: "GET",
					URL:    "/t",
					Headers: []models.Header{
						{Key: "X-Long", Value: longVal, Enabled: true},
					},
				},
			},
		},
	}
	out, err := g.Generate(col)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, longVal[:80]+"…") {
		t.Error("header value should be truncated to 80 chars")
	}
}
