package requester

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"flux/internal/models"
)


const defaultTimeout = 30 * time.Second

// sharedTransport is reused for TCP connection pooling.
var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 10,
	IdleConnTimeout:     90 * time.Second,
}

// httpClient is the default client with no cookie jar.
var httpClient = &http.Client{Transport: sharedTransport}

// Execute runs the given RequestPayload under the supplied context. If jar is
// non-nil, cookies are automatically stored from Set-Cookie responses and
// replayed on subsequent requests to the same domain.
func Execute(ctx context.Context, payload models.RequestPayload, jar http.CookieJar) models.ResponseResult {
	client := httpClient
	if jar != nil {
		client = &http.Client{Jar: jar, Transport: sharedTransport}
	}
	start := time.Now()

	finalURL, err := buildURL(payload.URL, payload.Params)
	if err != nil {
		return errResult(err, time.Since(start))
	}

	body, contentType, err := buildBody(payload)
	if err != nil {
		return errResult(err, time.Since(start))
	}

	method := strings.ToUpper(strings.TrimSpace(payload.Method))
	if method == "" {
		method = http.MethodGet
	}

	// Apply a fallback timeout if the caller's context has none.
	reqCtx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, method, finalURL, body)
	if err != nil {
		return errResult(err, time.Since(start))
	}

	applyHeaders(req, payload.Headers)
	if contentType != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", contentType)
	}
	applyAuth(req, payload.AuthType, payload.AuthValue)

	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return errResult(errors.New("request canceled"), time.Since(start))
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return errResult(errors.New("request timed out after 30s"), time.Since(start))
		}
		return errResult(err, time.Since(start))
	}
	defer resp.Body.Close()

	respBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
	timing := time.Since(start)
	if readErr != nil {
		if errors.Is(readErr, context.Canceled) {
			return errResult(errors.New("request canceled"), timing)
		}
		return errResult(readErr, timing)
	}

	headers := flattenHeaders(resp.Header)

	// Collect cookies set by this response for the frontend to display.
	var setCookies []models.CookieSummary
	if resp.Request != nil && resp.Request.URL != nil {
		for _, c := range resp.Cookies() {
			exp := ""
			if !c.Expires.IsZero() {
				exp = c.Expires.Format(time.RFC3339)
			}
			setCookies = append(setCookies, models.CookieSummary{
				Name:     c.Name,
				Value:    c.Value,
				Domain:   resp.Request.URL.Hostname(),
				Expires:  exp,
				HttpOnly: c.HttpOnly,
				Secure:   c.Secure,
			})
		}
	}

	return models.ResponseResult{
		Status:     resp.Status,
		StatusCode: resp.StatusCode,
		Headers:    headers,
		Body:       string(respBody),
		TimingMs:   timing.Milliseconds(),
		SizeBytes:  int64(len(respBody)),
		Cookies:    setCookies,
		Error:      "",
	}
}

func buildURL(rawURL string, params []models.Header) (string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return "", errors.New("URL is required")
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "https://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	q := parsed.Query()
	for _, p := range params {
		if !p.Enabled || p.Key == "" {
			continue
		}
		q.Add(p.Key, p.Value)
	}
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}

func buildBody(p models.RequestPayload) (io.Reader, string, error) {
	switch p.BodyType {
	case "", "none":
		return nil, "", nil
	case "json":
		if strings.TrimSpace(p.Body) == "" {
			return nil, "application/json", nil
		}
		return strings.NewReader(p.Body), "application/json", nil
	case "graphql":
		var buf strings.Builder
		buf.WriteString(`{"query":`)
		buf.WriteString(strconv.Quote(p.GraphQLQuery))
		if p.GraphQLVariables != "" {
			buf.WriteString(`,"variables":`)
			buf.WriteString(p.GraphQLVariables)
		}
		buf.WriteString("}")
		return strings.NewReader(buf.String()), "application/json", nil
	case "urlencoded":
		values := url.Values{}
		for _, kv := range p.BodyForm {
			if !kv.Enabled || kv.Key == "" {
				continue
			}
			values.Add(kv.Key, kv.Value)
		}
		return strings.NewReader(values.Encode()), "application/x-www-form-urlencoded", nil
	case "form":
		values := url.Values{}
		for _, kv := range p.BodyForm {
			if !kv.Enabled || kv.Key == "" {
				continue
			}
			values.Add(kv.Key, kv.Value)
		}
		return strings.NewReader(values.Encode()), "application/x-www-form-urlencoded", nil
	default:
		return nil, "", nil
	}
}

func applyHeaders(req *http.Request, headers []models.Header) {
	for _, h := range headers {
		if !h.Enabled || h.Key == "" {
			continue
		}
		req.Header.Set(h.Key, h.Value)
	}
}

func applyAuth(req *http.Request, authType, authValue string) {
	switch authType {
	case "bearer":
		if authValue != "" {
			req.Header.Set("Authorization", "Bearer "+authValue)
		}
	case "basic":
		// authValue is "user:pass"
		if authValue != "" {
			encoded := base64.StdEncoding.EncodeToString([]byte(authValue))
			req.Header.Set("Authorization", "Basic "+encoded)
		}
	case "apikey":
		// authValue is "header:HeaderName:value" or "query:paramName:value"
		parts := strings.SplitN(authValue, ":", 3)
		if len(parts) != 3 || parts[2] == "" {
			return
		}
		in, name, val := parts[0], parts[1], parts[2]
		switch in {
		case "header":
			req.Header.Set(name, val)
		case "query":
			q := req.URL.Query()
			q.Set(name, val)
			req.URL.RawQuery = q.Encode()
		}
	}
}

func flattenHeaders(h http.Header) map[string]string {
	out := make(map[string]string, len(h))
	for k, v := range h {
		out[k] = strings.Join(v, ", ")
	}
	return out
}

func errResult(err error, elapsed time.Duration) models.ResponseResult {
	return models.ResponseResult{
		Status:     "",
		StatusCode: 0,
		Headers:    map[string]string{},
		Body:       "",
		TimingMs:   elapsed.Milliseconds(),
		SizeBytes:  0,
		Error:      err.Error(),
	}
}
