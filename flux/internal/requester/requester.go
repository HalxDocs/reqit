package requester

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"flux/internal/models"
)

const defaultTimeout = 30 * time.Second

var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 10,
	IdleConnTimeout:     90 * time.Second,
}

var httpClient = &http.Client{Transport: sharedTransport}

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

	reqCtx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, method, finalURL, body)
	if err != nil {
		return errResult(err, time.Since(start))
	}

	req.Header.Set("User-Agent", "reqit/0.9.2")
	applyHeaders(req, payload.Headers)
	if contentType != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", contentType)
	}
	applyAuth(req, payload.AuthType, payload.AuthValue)

	var (
		dnsStart     time.Time
		dnsEnd       time.Time
		tcpStart     time.Time
		tcpEnd       time.Time
		tlsStart     time.Time
		tlsEnd       time.Time
		gotFirstByte time.Time
	)
	trace := &httptrace.ClientTrace{
		DNSStart:             func(_ httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone:              func(_ httptrace.DNSDoneInfo) { dnsEnd = time.Now() },
		ConnectStart:         func(_, _ string) { tcpStart = time.Now() },
		ConnectDone:          func(_, _ string, _ error) { tcpEnd = time.Now() },
		TLSHandshakeStart:    func() { tlsStart = time.Now() },
		TLSHandshakeDone:     func(_ tls.ConnectionState, _ error) { tlsEnd = time.Now() },
		GotFirstResponseByte: func() { gotFirstByte = time.Now() },
	}
	req = req.WithContext(httptrace.WithClientTrace(reqCtx, trace))

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
	downloadEnd := time.Now()
	timing := time.Since(start)
	if readErr != nil {
		if errors.Is(readErr, context.Canceled) {
			return errResult(errors.New("request canceled"), timing)
		}
		return errResult(readErr, timing)
	}

	headers := flattenHeaders(resp.Header)
	bodyIsBase64 := isBinaryContentType(resp.Header.Get("Content-Type"))
	var bodyStr string
	if bodyIsBase64 {
		bodyStr = base64.StdEncoding.EncodeToString(respBody)
	} else {
		bodyStr = string(respBody)
	}

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

	var timingBreakdown *models.TimingBreakdown
	{
		var dns, tcp, tlsH, ttfb, download int64
		if !dnsStart.IsZero() && !dnsEnd.IsZero() {
			dns = dnsEnd.Sub(dnsStart).Milliseconds()
		}
		if !tcpStart.IsZero() && !tcpEnd.IsZero() {
			tcp = tcpEnd.Sub(tcpStart).Milliseconds()
		}
		if !tlsStart.IsZero() && !tlsEnd.IsZero() {
			tlsH = tlsEnd.Sub(tlsStart).Milliseconds()
		}
		if !gotFirstByte.IsZero() {
			ttfb = gotFirstByte.Sub(start).Milliseconds()
		}
		if !gotFirstByte.IsZero() {
			download = downloadEnd.Sub(gotFirstByte).Milliseconds()
		}
		timingBreakdown = &models.TimingBreakdown{
			DNSLookupMs:    dns,
			TCPConnectMs:   tcp,
			TLSHandshakeMs: tlsH,
			TTFBMs:         ttfb,
			DownloadMs:     download,
			TotalMs:        timing.Milliseconds(),
		}
	}

	return models.ResponseResult{
		Status:       resp.Status,
		StatusCode:   resp.StatusCode,
		Headers:      headers,
		Body:         bodyStr,
		BodyIsBase64: bodyIsBase64,
		TimingMs:     timing.Milliseconds(),
		Timing:       timingBreakdown,
		SizeBytes:    int64(len(respBody)),
		Cookies:      setCookies,
		Error:        "",
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
		hasFiles := false
		for _, kv := range p.BodyForm {
			if kv.Enabled && kv.ValueType == "file" && kv.Value != "" {
				hasFiles = true
				break
			}
		}
		if !hasFiles {
			values := url.Values{}
			for _, kv := range p.BodyForm {
				if !kv.Enabled || kv.Key == "" {
					continue
				}
				values.Add(kv.Key, kv.Value)
			}
			return strings.NewReader(values.Encode()), "application/x-www-form-urlencoded", nil
		}
		return buildMultipartBody(p.BodyForm)
	default:
		return nil, "", nil
	}
}

func buildMultipartBody(form []models.Header) (io.Reader, string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for _, kv := range form {
		if !kv.Enabled || kv.Key == "" {
			continue
		}
		if kv.ValueType == "file" && kv.Value != "" {
			f, err := os.Open(kv.Value)
			if err != nil {
				continue
			}
			fw, err := w.CreateFormFile(kv.Key, filepath.Base(kv.Value))
			if err != nil {
				f.Close()
				continue
			}
			_, _ = io.Copy(fw, f)
			f.Close()
		} else {
			_ = w.WriteField(kv.Key, kv.Value)
		}
	}
	_ = w.Close()
	return &buf, w.FormDataContentType(), nil
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
	case "token":
		if authValue != "" {
			req.Header.Set("Authorization", "Token "+authValue)
		}
	case "basic":
		if authValue != "" {
			encoded := base64.StdEncoding.EncodeToString([]byte(authValue))
			req.Header.Set("Authorization", "Basic "+encoded)
		}
	case "digest":
		if authValue != "" && strings.Contains(authValue, ":") {
			parts := strings.SplitN(authValue, ":", 2)
			req.SetBasicAuth(parts[0], parts[1])
			// Mark as digest — the transport will handle the challenge
			req.Header.Set("X-Auth-Mode", "digest")
		}
	case "ntlm":
		if authValue != "" && strings.Contains(authValue, ":") {
			parts := strings.SplitN(authValue, ":", 2)
			req.SetBasicAuth(parts[0], parts[1])
			req.Header.Set("X-Auth-Mode", "ntlm")
		}
	case "apikey":
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
	case "oauth2":
		if authValue != "" {
			// authValue is JSON with access_token field
			var cfg struct {
				AccessToken string `json:"accessToken"`
				TokenType   string `json:"tokenType"`
			}
			if json.Unmarshal([]byte(authValue), &cfg) == nil && cfg.AccessToken != "" {
				tokenType := cfg.TokenType
				if tokenType == "" {
					tokenType = "Bearer"
				}
				req.Header.Set("Authorization", tokenType+" "+cfg.AccessToken)
			}
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

func isBinaryContentType(ct string) bool {
	lower := strings.ToLower(ct)
	return strings.Contains(lower, "image") ||
		strings.Contains(lower, "octet-stream") ||
		strings.Contains(lower, "binary") ||
		strings.Contains(lower, "pdf") ||
		strings.Contains(lower, "zip") ||
		strings.Contains(lower, "gzip") ||
		strings.Contains(lower, "audio") ||
		strings.Contains(lower, "video")
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
