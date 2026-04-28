// Package postman parses a Postman v2.1 collection JSON document into a flat
// list of Flux SavedRequest values that can be appended to a collection.
package postman

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
)

type rawCollection struct {
	Info json.RawMessage `json:"info"`
	Item []rawItem       `json:"item"`
}

type rawItem struct {
	Name    string          `json:"name"`
	Item    []rawItem       `json:"item"`
	Request json.RawMessage `json:"request"`
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
	URLEncoded []rawKV `json:"urlencoded"`
	FormData   []rawKV `json:"formdata"`
}

type rawAuth struct {
	Type   string  `json:"type"`
	Bearer []rawKV `json:"bearer"`
	Basic  []rawKV `json:"basic"`
}

type rawURL struct {
	Raw   string  `json:"raw"`
	Host  any     `json:"host"`
	Path  any     `json:"path"`
	Query []rawKV `json:"query"`
}

// Parse decodes a Postman v2.1 collection JSON document and returns the saved
// requests with the supplied collection ID set on each. The caller persists
// them via collections.AddRequest or similar.
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
	// Postman allows the request to be a bare URL string for simple GETs.
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
			bodyType = "json"
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

	authType := "none"
	authValue := ""
	if rr.Auth != nil {
		switch rr.Auth.Type {
		case "bearer":
			authType = "bearer"
			for _, kv := range rr.Auth.Bearer {
				if kv.Key == "token" {
					authValue = kv.Value
					break
				}
			}
		case "basic":
			authType = "basic"
			user, pass := "", ""
			for _, kv := range rr.Auth.Basic {
				switch kv.Key {
				case "username":
					user = kv.Value
				case "password":
					pass = kv.Value
				}
			}
			authValue = user + ":" + pass
		}
	}

	return models.RequestPayload{
		Method:    method,
		URL:       urlStr,
		Headers:   headers,
		Params:    params,
		BodyType:  bodyType,
		Body:      body,
		BodyForm:  bodyForm,
		AuthType:  authType,
		AuthValue: authValue,
	}, nil
}

func parseURL(raw json.RawMessage) (string, []models.Header) {
	if len(raw) == 0 {
		return "", nil
	}
	// URL can be a plain string …
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString, nil
	}
	// … or a structured object.
	var u rawURL
	if err := json.Unmarshal(raw, &u); err != nil {
		return "", nil
	}
	params := []models.Header{}
	for _, q := range u.Query {
		params = append(params, models.Header{Key: q.Key, Value: q.Value, Enabled: !q.Disabled})
	}
	return u.Raw, params
}

