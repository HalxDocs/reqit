package postman

import (
	"fmt"
	"strings"

	"flux/internal/models"
)

// MapBodyMode translates Postman body mode strings to reqit body types.
func MapBodyMode(mode string) string {
	switch strings.ToLower(mode) {
	case "raw":
		return "raw"
	case "urlencoded":
		return "form"
	case "formdata":
		return "multipart"
	case "file":
		return "file"
	case "graphql":
		return "graphql"
	default:
		return "raw"
	}
}

// MapAuth expands Postman auth into reqit header entries.
func MapAuth(auth *rawAuth) []models.Header {
	if auth == nil {
		return nil
	}
	var headers []models.Header

	switch strings.ToLower(auth.Type) {
	case "bearer":
		for _, b := range auth.Bearer {
			if strings.EqualFold(b.Key, "token") && b.Value != "" {
				headers = append(headers, models.Header{
					Key: "Authorization", Value: "Bearer " + b.Value, Enabled: !b.Disabled,
				})
			}
		}
	case "beareralt":
		for _, b := range auth.BearerAlt {
			if strings.EqualFold(b.Key, "token") && b.Value != "" {
				headers = append(headers, models.Header{
					Key: "Authorization", Value: "Bearer " + b.Value, Enabled: !b.Disabled,
				})
			}
		}
	case "basic":
		var username, password string
		for _, b := range auth.Basic {
			if strings.EqualFold(b.Key, "username") {
				username = b.Value
			}
			if strings.EqualFold(b.Key, "password") {
				password = b.Value
			}
		}
		if username != "" || password != "" {
			headers = append(headers, models.Header{
				Key: "Authorization", Value: fmt.Sprintf("Basic %s:%s", username, password), Enabled: true,
			})
		}
	case "apikey":
		var key, val, in string
		for _, a := range auth.APIKey {
			if strings.EqualFold(a.Key, "key") {
				key = a.Value
			}
			if strings.EqualFold(a.Key, "value") {
				val = a.Value
			}
			if strings.EqualFold(a.Key, "in") {
				in = a.Value
			}
		}
		if key != "" && val != "" && (in == "header" || in == "") {
			headers = append(headers, models.Header{
				Key: key, Value: val, Enabled: true,
			})
		}
	case "digest":
		for _, d := range auth.Digest {
			if strings.EqualFold(d.Key, "username") && d.Value != "" {
				headers = append(headers, models.Header{
					Key: "Authorization", Value: "Digest username=" + d.Value, Enabled: true,
				})
			}
		}
	case "oauth2":
		for _, o := range auth.OAuth2 {
			if strings.EqualFold(o.Key, "accessToken") && o.Value != "" {
				headers = append(headers, models.Header{
					Key: "Authorization", Value: "Bearer " + o.Value, Enabled: true,
				})
			}
		}
	}

	return headers
}

// MapScripts extracts pre-request and test scripts from Postman events.
func MapScripts(events []rawEvent) (preScript, postScript string) {
	for _, ev := range events {
		if len(ev.Script.Exec) == 0 {
			continue
		}
		script := strings.Join(ev.Script.Exec, "\n")
		transpiled := TranspileScript(script)
		switch strings.ToLower(ev.Listen) {
		case "prerequest":
			preScript = transpiled
		case "test":
			postScript = transpiled
		}
	}
	return
}

// MapURL reconstructs a URL string from Postman's structured URL format.
func MapURL(url rawURL) string {
	if url.Raw != "" {
		return url.Raw
	}

	var sb strings.Builder
	if url.Protocol != "" {
		sb.WriteString(url.Protocol)
		sb.WriteString("://")
	} else {
		sb.WriteString("https://")
	}

	hostParts, _ := url.Host.([]interface{})
	for i, p := range hostParts {
		if i > 0 {
			sb.WriteString(".")
		}
		sb.WriteString(fmt.Sprint(p))
	}

	if url.Port != "" {
		sb.WriteString(":")
		sb.WriteString(url.Port)
	}

	pathParts, _ := url.Path.([]interface{})
	for _, p := range pathParts {
		s := fmt.Sprint(p)
		if !strings.HasPrefix(s, "/") {
			sb.WriteString("/")
		}
		sb.WriteString(s)
	}

	if len(url.Query) > 0 {
		sb.WriteString("?")
		for i, q := range url.Query {
			if i > 0 {
				sb.WriteString("&")
			}
			sb.WriteString(q.Key)
			if q.Value != "" {
				sb.WriteString("=")
				sb.WriteString(q.Value)
			}
		}
	}

	return sb.String()
}
