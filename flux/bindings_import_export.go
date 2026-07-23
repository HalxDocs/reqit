package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/audit"
	"flux/internal/contract"
	curlpkg "flux/internal/curl"
	htmldoc "flux/internal/export/html"
	"flux/internal/export/markdown"
	"flux/internal/hoppscotch"
	"flux/internal/insomnia"
	"flux/internal/models"
	"flux/internal/openapi"
	"flux/internal/postman"
	regpkg "flux/internal/registry"
	schemapkg "flux/internal/schema"
	"flux/internal/security"
	"flux/internal/telemetry"
)

type RegistryPushResult struct {
	URL string `json:"url"`
}

type ExportMarkdownOpts struct {
	IncludeHeaders  bool   `json:"includeHeaders"`
	IncludeBody     bool   `json:"includeBody"`
	IncludeExamples bool   `json:"includeExamples"`
	BaseURL         string `json:"baseUrl"`
	Timestamp       bool   `json:"timestamp"`
}

type ExportHTMLDocsOpts struct {
	IncludeHeaders  bool   `json:"includeHeaders"`
	IncludeBody     bool   `json:"includeBody"`
	IncludeExamples bool   `json:"includeExamples"`
	BaseURL         string `json:"baseUrl"`
	Timestamp       bool   `json:"timestamp"`
	DarkMode        bool   `json:"darkMode"`
}

func (a *App) ExportOpenAPI(collectionID string) (string, error) {
	if a.collections == nil {
		return "", fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collectionID {
			result, err := openapi.Export(c)
			if err == nil && a.audit != nil {
				_ = a.audit.Log("user", audit.ActionExport, "collection", collectionID, "", map[string]string{
					"format": "openapi",
				})
			}
			return result, err
		}
	}
	return "", fmt.Errorf("collection not found: %s", collectionID)
}

// PreviewOpenAPI exports the spec as HTML and opens it in the default browser.
func (a *App) PreviewOpenAPI(collectionID string) error {
	if a.collections == nil {
		return fmt.Errorf("no active workspace")
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return err
	}
	for _, c := range all {
		if c.ID == collectionID {
			htmlPath, hErr := openapi.ExportToHTML(c, dir)
			if hErr != nil {
				return hErr
			}
			runtime.BrowserOpenURL(a.ctx, "file:///"+strings.ReplaceAll(htmlPath, "\\", "/"))
			return nil
		}
	}
	return fmt.Errorf("collection not found: %s", collectionID)
}

// ExportOpenAPIFiles writes both the JSON spec and a self-contained HTML page
// (Swagger UI embedded) to the workspace directory and returns their paths.
func (a *App) ExportOpenAPIFiles(collectionID string) (map[string]string, error) {
	if a.collections == nil {
		return nil, fmt.Errorf("no active workspace")
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return nil, fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	for _, c := range all {
		if c.ID == collectionID {
			jsonPath, jErr := openapi.ExportToFile(c, dir)
			if jErr != nil {
				return nil, jErr
			}
			htmlPath, hErr := openapi.ExportToHTML(c, dir)
			if hErr != nil {
				return nil, hErr
			}
			return map[string]string{"json": jsonPath, "html": htmlPath}, nil
		}
	}
	return nil, fmt.Errorf("collection not found: %s", collectionID)
}

func (a *App) ImportPostman(targetCollID, jsonData string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	requests, err := postman.Parse([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionImport, "collection", targetCollID, "", map[string]string{
			"source": "postman",
			"count":  fmt.Sprintf("%d", len(requests)),
		})
	}
	return len(requests), nil
}

// ImportPostmanFull parses a Postman collection including variables, scripts, and collection-level auth.
func (a *App) ImportPostmanFull(jsonData, targetCollID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	if targetCollID == "" {
		return "", errors.New("target collection is required")
	}
	result, err := postman.ParseFull([]byte(jsonData), targetCollID)
	if err != nil {
		return "", err
	}
	for _, r := range result.Requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return "", err
		}
	}
	// Transpile any pm.* scripts
	transpiled := make([]string, len(result.Scripts))
	for i, s := range result.Scripts {
		transpiled[i] = postman.TranspileScript(s)
	}
	out, _ := json.Marshal(map[string]interface{}{
		"requests":      len(result.Requests),
		"variables":     result.Variables,
		"scripts":       transpiled,
		"collectionAuth": result.Auth,
	})
	runtime.EventsEmit(a.ctx, "collections:changed")
	return string(out), nil
}

// ImportPostmanEnvironment parses a Postman environment file.
func (a *App) ImportPostmanEnvironment(jsonData, envName string) (string, error) {
	if a.environments == nil {
		return "", errors.New("no active workspace")
	}
	envData, err := postman.ParseEnvironment([]byte(jsonData))
	if err != nil {
		return "", err
	}
	name := envName
	if name == "" {
		name = envData.Name
	}
	env, err := a.environments.Create(name)
	if err != nil {
		return "", err
	}
	// Add variables to the new environment
	vars := []models.EnvVar{}
	for _, v := range envData.Values {
		if v.Enabled {
			vars = append(vars, models.EnvVar{Key: v.Key, Value: v.Value, Enabled: true})
		}
	}
	if err := a.environments.Update(env.ID, env.Name, vars); err != nil {
		return "", err
	}
	runtime.EventsEmit(a.ctx, "environments:changed")
	return name, nil
}

// ExportPostman exports collections to Postman v2.1 format.
func (a *App) ExportPostman(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := postman.Export(c.Requests, c.Name, "")
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ImportInsomnia parses an Insomnia export file.
func (a *App) ImportInsomnia(jsonData, targetCollID string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	result, err := insomnia.Import([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range result.Requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	runtime.EventsEmit(a.ctx, "collections:changed")
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionImport, "collection", targetCollID, "", map[string]string{
			"source": "insomnia",
			"count":  fmt.Sprintf("%d", len(result.Requests)),
		})
	}
	return len(result.Requests), nil
}

// ExportInsomnia exports collections to Insomnia JSON format.
func (a *App) ExportInsomnia(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := insomnia.Export(c.Requests, c.Name)
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ImportHoppscotch parses a Hoppscotch export file.
func (a *App) ImportHoppscotch(jsonData, targetCollID string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	requests, err := hoppscotch.Import([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	runtime.EventsEmit(a.ctx, "collections:changed")
	return len(requests), nil
}

// ExportHoppscotch exports collections to Hoppscotch JSON format.
func (a *App) ExportHoppscotch(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := hoppscotch.Export(c.Requests, c.Name)
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ParseCurl parses a cURL command and returns the request data as JSON.
func (a *App) ParseCurl(curlCmd string) (string, error) {
	result, err := curlpkg.ParseCurlString(curlCmd)
	if err != nil {
		return "", err
	}
	payload := curlpkg.ToRequestPayload(result)
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) ImportOpenAPI(path string) (*openapi.ImportResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	result, err := openapi.Import(path)
	if err != nil {
		return nil, err
	}
	for _, coll := range result.Collections {
		created, cerr := a.collections.CreateCollection(coll.Name)
		if cerr != nil {
			return nil, cerr
		}
		for _, req := range coll.Requests {
			req.CollID = created.ID
			if _, aerr := a.collections.AddRequest(created.ID, req.Name, req.Payload); aerr != nil {
				return nil, aerr
			}
		}
	}

	// Save baseline snapshot for future drift detection
	if err := a.SaveSchemaSnapshot(filepath.Base(path)); err != nil {
		// Non-fatal — skip silently
	}

	runtime.EventsEmit(a.ctx, "collections:changed")
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionImport, "spec", filepath.Base(path), "", map[string]string{
			"source": "openapi",
			"collections": fmt.Sprintf("%d", len(result.Collections)),
		})
	}
	return result, nil
}

// ImportHAR imports an HTTP Archive (HAR) file as a new collection.
func (a *App) ImportHAR(jsonData, targetCollID string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}

	var har struct {
		Log struct {
			Entries []struct {
				Request struct {
					Method  string `json:"method"`
					URL     string `json:"url"`
					Headers []struct {
						Name  string `json:"name"`
						Value string `json:"value"`
					} `json:"headers"`
					PostData struct {
						MimeType string `json:"mimeType"`
						Text     string `json:"text"`
					} `json:"postData"`
				} `json:"request"`
				Response struct {
					Status  int `json:"status"`
					Content struct {
						Text string `json:"text"`
					} `json:"content"`
				} `json:"response"`
			} `json:"entries"`
		} `json:"log"`
	}

	if err := json.Unmarshal([]byte(jsonData), &har); err != nil {
		return 0, fmt.Errorf("invalid HAR JSON: %w", err)
	}

	if len(har.Log.Entries) == 0 {
		return 0, fmt.Errorf("HAR file contains no entries")
	}

	// Create or use target collection.
	collID := targetCollID
	if collID == "" {
		coll, cerr := a.collections.CreateCollection("HAR Import")
		if cerr != nil {
			return 0, cerr
		}
		collID = coll.ID
	}

	count := 0
	for _, entry := range har.Log.Entries {
		method := strings.ToUpper(entry.Request.Method)
		if method == "" {
			method = "GET"
		}

		// Build headers.
		var headers []models.Header
		for _, h := range entry.Request.Headers {
			headers = append(headers, models.Header{
				Key:     h.Name,
				Value:   h.Value,
				Enabled: true,
			})
		}

		// Build body.
		bodyType := "none"
		body := ""
		if entry.Request.PostData.Text != "" {
			bodyType = "raw"
			body = entry.Request.PostData.Text
		}

		payload := models.RequestPayload{
			Method:   method,
			URL:      entry.Request.URL,
			Headers:  headers,
			BodyType: bodyType,
			Body:     body,
			BodyForm: []models.Header{},
			Params:   []models.Header{},
		}

		name := fmt.Sprintf("%s %s", method, entry.Request.URL)
		if len(name) > 80 {
			name = name[:80] + "…"
		}

		if _, aerr := a.collections.AddRequest(collID, name, payload); aerr != nil {
			continue
		}
		count++
	}

	runtime.EventsEmit(a.ctx, "collections:changed")
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionImport, "collection", collID, "", map[string]string{
			"source": "har",
			"count":  fmt.Sprintf("%d", count),
		})
	}
	return count, nil
}

func (a *App) PushToSwaggerHub(specJSON, apiKey, owner, name, version string) (*RegistryPushResult, error) {
	client := regpkg.NewSwaggerHubClient(apiKey, owner, name)
	if version != "" {
		client.SetVersion(version)
	}
	result, err := client.Push([]byte(specJSON))
	if err != nil {
		return nil, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "swaggerhub_push", nil)
	}
	return &RegistryPushResult{URL: result.URL}, nil
}

func (a *App) PullFromSwaggerHub(apiKey, owner, name, version string) (string, error) {
	client := regpkg.NewSwaggerHubClient(apiKey, owner, name)
	if version != "" {
		client.SetVersion(version)
	}
	data, err := client.Pull()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) PushToStoplight(specJSON, apiToken, projectSlug string) (*RegistryPushResult, error) {
	client := regpkg.NewStoplightClient(apiToken, projectSlug)
	result, err := client.Push([]byte(specJSON))
	if err != nil {
		return nil, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "stoplight_push", nil)
	}
	return &RegistryPushResult{URL: result.URL}, nil
}

func (a *App) PullFromStoplight(apiToken, projectSlug string) (string, error) {
	client := regpkg.NewStoplightClient(apiToken, projectSlug)
	data, err := client.Pull()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) LinkCollectionSpec(collID, specPath string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.SetSpec(collID, specPath)
}

func (a *App) InvalidateSpec(specPath string) {
	dir, _ := a.workspaces.ActiveDir()
	contract.Cache.Invalidate(filepath.Join(dir, specPath))
}

// FetchSpecFromURL downloads an OpenAPI spec from a URL, saves it to the
// workspace folder, and returns the relative path suitable for LinkCollectionSpec.
func (a *App) FetchSpecFromURL(rawURL string) (string, error) {
	if err := security.ValidateURL(rawURL); err != nil {
		return "", err
	}

	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return "", err
	}

	// Determine filename from the URL path.
	name := "openapi-spec.json"
	if u, err2 := http.NewRequest("GET", rawURL, nil); err2 == nil {
		if p := u.URL.Path; p != "" {
			if base := filepath.Base(p); base != "." && base != "/" {
				name = base
			}
		}
	}
	// Ensure it has a valid extension.
	if !strings.HasSuffix(name, ".json") && !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
		name += ".json"
	}
	// Validate filename doesn't escape workspace
	if err := security.ValidatePathWithinDir(dir, name); err != nil {
		return "", fmt.Errorf("invalid filename: %w", err)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(rawURL) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("failed to fetch spec from URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("spec URL returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Validate that it looks like JSON or YAML (basic check).
	trimmed := strings.TrimSpace(string(body))
	if len(trimmed) == 0 {
		return "", errors.New("spec URL returned empty content")
	}
	if trimmed[0] != '{' && trimmed[0] != '[' && !strings.Contains(trimmed, "openapi") && !strings.Contains(trimmed, "swagger") {
		return "", errors.New("URL does not appear to contain an OpenAPI spec")
	}

	dst := filepath.Join(dir, name)
	if err := os.WriteFile(dst, body, 0644); err != nil {
		return "", fmt.Errorf("failed to save spec file: %w", err)
	}

	// Auto-save baseline snapshot for future drift detection
	if err := a.SaveSchemaSnapshot(name); err != nil {
		// Non-fatal — skip silently
	}

	return name, nil
}

// SaveSchemaSnapshot captures and saves a baseline snapshot of an OpenAPI spec.
func (a *App) SaveSchemaSnapshot(specPath string) error {
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return err
	}

	fullPath := filepath.Join(dir, specPath)
	snap, err := schemapkg.CaptureSnapshot(fullPath)
	if err != nil {
		return fmt.Errorf("failed to capture snapshot: %w", err)
	}

	return schemapkg.SaveSnapshot(dir, specPath, snap)
}

// DetectSchemaDrift compares the current spec against its saved baseline snapshot.
// Returns the drift result, or nil if no baseline exists.
func (a *App) DetectSchemaDrift(specPath string) (*schemapkg.Drift, error) {
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return nil, err
	}

	baseline, err := schemapkg.LoadSnapshot(dir, specPath)
	if err != nil {
		// No baseline saved yet — this is the first import, no drift to detect
		return nil, nil
	}

	fullPath := filepath.Join(dir, specPath)
	current, err := schemapkg.CaptureSnapshot(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to capture current snapshot: %w", err)
	}

	drift := schemapkg.DetectDrift(baseline, current)
	return drift, nil
}

func (a *App) ExportCollectionMarkdown(colID string, opts ExportMarkdownOpts) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	var col *models.Collection
	for i := range all {
		if all[i].ID == colID {
			col = &all[i]
			break
		}
	}
	if col == nil {
		return "", errors.New("collection not found")
	}
	mo := markdown.ExportOptions{
		IncludeHeaders:  opts.IncludeHeaders,
		IncludeBody:     opts.IncludeBody,
		IncludeExamples: opts.IncludeExamples,
		BaseURL:         opts.BaseURL,
		Timestamp:       opts.Timestamp,
	}
	g := markdown.New(mo)
	md, err := g.Generate(col)
	if err != nil {
		return "", err
	}

	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	filename := col.Name + "_api_docs.md"
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Markdown API Documentation",
		DefaultFilename: filename,
		Filters:         []runtime.FileFilter{{DisplayName: "Markdown", Pattern: "*.md"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(md), 0644)
}

func (a *App) ExportCollectionHTML(colID string, opts ExportHTMLDocsOpts) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	var col *models.Collection
	for i := range all {
		if all[i].ID == colID {
			col = &all[i]
			break
		}
	}
	if col == nil {
		return "", errors.New("collection not found")
	}
	ho := htmldoc.ExportOptions{
		IncludeHeaders:  opts.IncludeHeaders,
		IncludeBody:     opts.IncludeBody,
		IncludeExamples: opts.IncludeExamples,
		BaseURL:         opts.BaseURL,
		Timestamp:       opts.Timestamp,
		DarkMode:        opts.DarkMode,
	}
	g := htmldoc.New(ho)
	html, err := g.Generate(col)
	if err != nil {
		return "", err
	}

	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	filename := col.Name + "_api_docs.html"
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save HTML API Documentation",
		DefaultFilename: filename,
		Filters:         []runtime.FileFilter{{DisplayName: "HTML Files", Pattern: "*.html"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(html), 0644)
}
