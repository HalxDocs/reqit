package postman

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
)

type rawCollection struct {
	Info     json.RawMessage `json:"info"`
	Item     []rawItem       `json:"item"`
	Variable []rawVar        `json:"variable"`
	Auth     *rawAuth        `json:"auth"`
}

type rawVar struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Type    string `json:"type"`
	Enabled bool   `json:"enabled"`
}

type rawItem struct {
	Name    string          `json:"name"`
	Item    []rawItem       `json:"item"`
	Request json.RawMessage `json:"request"`
	Event   []rawEvent      `json:"event"`
}

type rawEvent struct {
	Listen string   `json:"listen"`
	Script rawScript `json:"script"`
}

type rawScript struct {
	Exec []string `json:"exec"`
	Type string   `json:"type"`
}

type rawRequest struct {
	Method string         `json:"method"`
	Header []rawKV        `json:"header"`
	URL    json.RawMessage `json:"url"`
	Body   *rawBody       `json:"body"`
	Auth   *rawAuth       `json:"auth"`
}

type rawKV struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled"`
}

type rawBody struct {
	Mode       string  `json:"mode"`
	Raw        string  `json:"raw"`
	Options    *rawBodyOptions `json:"options"`
	URLEncoded []rawKV `json:"urlencoded"`
	FormData   []rawKV `json:"formdata"`
}

type rawBodyOptions struct {
	Raw rawLang `json:"raw"`
}

type rawLang struct {
	Language string `json:"language"`
}

type rawAuth struct {
	Type   string  `json:"type"`
	Bearer []rawKV `json:"bearer"`
	Basic  []rawKV `json:"basic"`
	APIKey []rawKV `json:"apikey"`
	Digest []rawKV `json:"digest"`
	OAuth2 []rawKV `json:"oauth2"`
	BearerAlt []rawKV `json:"bearerAlt"`
}

type rawURL struct {
	Raw     string  `json:"raw"`
	Host    any     `json:"host"`
	Path    any     `json:"path"`
	Query   []rawKV `json:"query"`
	Variable []rawVar `json:"variable"`
	Port    string  `json:"port"`
	Protocol string `json:"protocol"`
}

// EnvironmentData holds variables from a Postman environment file.
type EnvironmentData struct {
	Name     string   `json:"name"`
	Values   []rawVar `json:"values"`
}

// ImportResult holds everything parsed from a Postman collection + environment.
type ImportResult struct {
	Requests     []models.SavedRequest `json:"requests"`
	Variables    map[string]string     `json:"variables"`
	Scripts      []string              `json:"scripts"`
	Auth         *models.RequestPayload `json:"auth,omitempty"`
}

func Parse(data []byte, collID string) ([]models.SavedRequest, error) {
	if len(data) == 0 {
		return nil, errors.New("empty file")
	}
	var coll rawCollection
	if err := json.Unmarshal(data, &coll); err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	out := []models.SavedRequest{}
	walk(coll.Item, "", &out, collID, now)
	return out, nil
}

// ParseFull parses a Postman collection including variables, scripts, and auth.
func ParseFull(data []byte, collID string) (*ImportResult, error) {
	if len(data) == 0 {
		return nil, errors.New("empty file")
	}
	var coll rawCollection
	if err := json.Unmarshal(data, &coll); err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	out := []models.SavedRequest{}
	walk(coll.Item, "", &out, collID, now)

	vars := map[string]string{}
	for _, v := range coll.Variable {
		if v.Enabled && v.Key != "" {
			vars[v.Key] = v.Value
		}
	}

	var scripts []string
	for _, item := range coll.Item {
		extractScripts(item, &scripts)
	}

	var auth *models.RequestPayload
	if coll.Auth != nil {
		p := models.RequestPayload{}
		parseAuth(coll.Auth, &p)
		auth = &p
	}

	return &ImportResult{
		Requests:  out,
		Variables: vars,
		Scripts:   scripts,
		Auth:      auth,
	}, nil
}

// ParseEnvironment parses a Postman environment JSON file.
func ParseEnvironment(data []byte) (*EnvironmentData, error) {
	if len(data) == 0 {
		return nil, errors.New("empty file")
	}
	var env EnvironmentData
	if err := json.Unmarshal(data, &env); err != nil {
		return nil, err
	}
	return &env, nil
}

func extractScripts(item rawItem, scripts *[]string) {
	for _, e := range item.Event {
		if e.Script.Exec != nil {
			*scripts = append(*scripts, strings.Join(e.Script.Exec, "\n"))
		}
	}
	for _, sub := range item.Item {
		extractScripts(sub, scripts)
	}
}

// TranspileScript converts a Postman pm.* script to reqit equivalents.
func TranspileScript(script string) string {
	result := script
	result = strings.ReplaceAll(result, "pm.request.url", "req.request.url")
	result = strings.ReplaceAll(result, "pm.request.method", "req.request.method")
	result = strings.ReplaceAll(result, "pm.request.headers.add(", "req.request.headers.set(")
	result = strings.ReplaceAll(result, "pm.request.headers.get(", "req.request.headers.get(")
	result = strings.ReplaceAll(result, "pm.response.code", "req.response.statusCode")
	result = strings.ReplaceAll(result, "pm.response.status", "req.response.statusText")
	result = strings.ReplaceAll(result, "pm.response.json()", "req.response.json()")
	result = strings.ReplaceAll(result, "pm.response.text()", "req.response.text()")
	result = strings.ReplaceAll(result, "pm.variables.get(", "req.variables.get(")
	result = strings.ReplaceAll(result, "pm.variables.set(", "req.variables.set(")
	result = strings.ReplaceAll(result, "pm.environment.get(", "req.env.get(")
	result = strings.ReplaceAll(result, "pm.environment.set(", "req.env.set(")
	result = strings.ReplaceAll(result, "pm.globals.get(", "req.globals.get(")
	result = strings.ReplaceAll(result, "pm.globals.set(", "req.globals.set(")
	result = strings.ReplaceAll(result, "pm.iterationData.get(", "req.iteration.get(")
	result = strings.ReplaceAll(result, "pm.sendRequest(", "req.send(")
	result = strings.ReplaceAll(result, "pm.test(", "req.assert(")
	result = strings.ReplaceAll(result, "pm.expect(", "req.expect(")
	result = strings.ReplaceAll(result, "pm", "req")
	return result
}

func walk(items []rawItem, prefix string, out *[]models.SavedRequest, collID, now string) {
	for _, it := range items {
		name := it.Name
		if prefix != "" {
			name = prefix + " / " + name
		}
		if len(it.Item) > 0 {
			walk(it.Item, name, out, collID, now)
			continue
		}
		if len(it.Request) == 0 {
			continue
		}
		payload, err := parseRequest(it.Request)
		if err != nil {
			continue
		}
		*out = append(*out, models.SavedRequest{
			ID:        uuid.NewString(),
			Name:      name,
			CollID:    collID,
			Payload:   payload,
			CreatedAt: now,
		})
	}
}

func parseRequest(raw json.RawMessage) (models.RequestPayload, error) {
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return models.RequestPayload{Method: "GET", URL: asString, BodyType: "none", AuthType: "none"}, nil
	}
	var rr rawRequest
	if err := json.Unmarshal(raw, &rr); err != nil {
		return models.RequestPayload{}, err
	}
	method := strings.ToUpper(strings.TrimSpace(rr.Method))
	if method == "" {
		method = "GET"
	}
	urlStr, params := parseURL(rr.URL)
	headers := []models.Header{}
	for _, h := range rr.Header {
		headers = append(headers, models.Header{Key: h.Key, Value: h.Value, Enabled: !h.Disabled})
	}
	bodyType := "none"
	body := ""
	bodyForm := []models.Header{}
	if rr.Body != nil {
		switch rr.Body.Mode {
		case "raw":
			lang := "json"
			if rr.Body.Options != nil && rr.Body.Options.Raw.Language != "" {
				lang = strings.ToLower(rr.Body.Options.Raw.Language)
			}
			if lang == "json" {
				bodyType = "json"
			} else if lang == "xml" {
				bodyType = "xml"
			} else if lang == "text" {
				bodyType = "raw"
			} else {
				bodyType = "json"
			}
			body = rr.Body.Raw
		case "urlencoded":
			bodyType = "urlencoded"
			for _, kv := range rr.Body.URLEncoded {
				bodyForm = append(bodyForm, models.Header{Key: kv.Key, Value: kv.Value, Enabled: !kv.Disabled})
			}
		case "formdata":
			bodyType = "form"
			for _, kv := range rr.Body.FormData {
				bodyForm = append(bodyForm, models.Header{Key: kv.Key, Value: kv.Value, Enabled: !kv.Disabled})
			}
		}
	}
	payload := models.RequestPayload{
		Method:   method,
		URL:      urlStr,
		Headers:  headers,
		Params:   params,
		BodyType: bodyType,
		Body:     body,
		BodyForm: bodyForm,
		AuthType: "none",
	}
	parseAuth(rr.Auth, &payload)
	return payload, nil
}

func parseAuth(auth *rawAuth, payload *models.RequestPayload) {
	if auth == nil {
		return
	}
	switch auth.Type {
	case "bearer":
		payload.AuthType = "bearer"
		for _, kv := range auth.Bearer {
			if kv.Key == "token" {
				payload.AuthValue = kv.Value
				return
			}
		}
	case "bearerAlt":
		payload.AuthType = "bearer"
		for _, kv := range auth.BearerAlt {
			if kv.Key == "token" {
				payload.AuthValue = kv.Value
				return
			}
		}
	case "basic":
		payload.AuthType = "basic"
		user, pass := "", ""
		for _, kv := range auth.Basic {
			switch kv.Key {
			case "username": user = kv.Value
			case "password": pass = kv.Value
			}
		}
		payload.AuthValue = user + ":" + pass
	case "apikey":
		payload.AuthType = "apikey"
		key, val := "", ""
		for _, kv := range auth.APIKey {
			switch kv.Key {
			case "key": key = kv.Value
			case "value": val = kv.Value
			}
		}
		payload.AuthValue = key + ":" + val
	case "digest":
		payload.AuthType = "digest"
		user, pass := "", ""
		for _, kv := range auth.Digest {
			switch kv.Key {
			case "username": user = kv.Value
			case "password": pass = kv.Value
			}
		}
		payload.AuthValue = user + ":" + pass
	case "oauth2":
		payload.AuthType = "oauth2"
		for _, kv := range auth.OAuth2 {
			if kv.Key == "accessToken" {
				payload.AuthValue = kv.Value
				return
			}
		}
	}
}

func parseURL(raw json.RawMessage) (string, []models.Header) {
	if len(raw) == 0 {
		return "", nil
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString, nil
	}
	var u rawURL
	if err := json.Unmarshal(raw, &u); err != nil {
		return "", nil
	}
	params := []models.Header{}
	for _, q := range u.Query {
		params = append(params, models.Header{Key: q.Key, Value: q.Value, Enabled: !q.Disabled})
	}
	if u.Raw != "" {
		return u.Raw, params
	}
	// Reconstruct URL from components
	sb := strings.Builder{}
	if u.Protocol != "" {
		sb.WriteString(u.Protocol)
		sb.WriteString("://")
	}
	hostStr := fmt.Sprintf("%v", u.Host)
	hostStr = strings.Trim(hostStr, "[]")
	hostStr = strings.ReplaceAll(hostStr, " ", "")
	sb.WriteString(hostStr)
	if u.Port != "" {
		sb.WriteString(":" + u.Port)
	}
	pathStr := fmt.Sprintf("%v", u.Path)
	pathStr = strings.Trim(pathStr, "[]")
	pathStr = strings.ReplaceAll(pathStr, " ", "/")
	pathStr = strings.ReplaceAll(pathStr, ",", "/")
	if pathStr != "" && !strings.HasPrefix(pathStr, "/") {
		sb.WriteString("/")
	}
	sb.WriteString(pathStr)
	if len(params) > 0 {
		sb.WriteString("?")
		for i, p := range params {
			if i > 0 {
				sb.WriteString("&")
			}
			sb.WriteString(p.Key + "=" + p.Value)
		}
	}
	return sb.String(), params
}

// Export serialises requests into a Postman v2.1 collection JSON.
func Export(requests []models.SavedRequest, collectionName, schemaURL string) ([]byte, error) {
	if schemaURL == "" {
		schemaURL = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	}
	items := make([]map[string]interface{}, 0, len(requests))
	for _, r := range requests {
		item := requestToPostmanItem(r)
		items = append(items, item)
	}
	info := map[string]interface{}{
		"name":   collectionName,
		"schema": schemaURL,
	}
	doc := map[string]interface{}{
		"info": info,
		"item": items,
	}
	return json.MarshalIndent(doc, "", "  ")
}

func requestToPostmanItem(r models.SavedRequest) map[string]interface{} {
	req := map[string]interface{}{
		"method": r.Payload.Method,
		"header": headersToPostman(r.Payload.Headers),
	}
	if r.Payload.URL != "" {
		req["url"] = r.Payload.URL
	}
	// Body
	if r.Payload.BodyType != "none" {
		body := map[string]interface{}{"mode": "raw"}
		body["raw"] = r.Payload.Body
		if r.Payload.BodyType == "urlencoded" {
			body["mode"] = "urlencoded"
			body["urlencoded"] = headersToPostman(r.Payload.BodyForm)
		} else if r.Payload.BodyType == "form" {
			body["mode"] = "formdata"
			body["formdata"] = headersToPostman(r.Payload.BodyForm)
		}
		req["body"] = body
	}
	// Auth
	if r.Payload.AuthType != "none" {
		bodyAuth := map[string]interface{}{"type": r.Payload.AuthType}
		bodyAuth[r.Payload.AuthType] = []map[string]string{{"key": "value", "value": r.Payload.AuthValue}}
		req["auth"] = bodyAuth
	}
	return map[string]interface{}{
		"name":    r.Name,
		"request": req,
	}
}

func headersToPostman(hh []models.Header) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(hh))
	for _, h := range hh {
		out = append(out, map[string]interface{}{
			"key":   h.Key,
			"value": h.Value,
			"type":  "text",
		})
	}
	return out
}
