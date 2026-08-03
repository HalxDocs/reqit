package oauth2

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OAuth2Config struct {
	AuthURL      string `json:"authUrl"`
	TokenURL     string `json:"tokenUrl"`
	DeviceURL    string `json:"deviceUrl"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Scopes       string `json:"scopes"`
	RedirectURI  string `json:"redirectUri"`
	UsePKCE      bool   `json:"usePkce"`
}

type TokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken,omitempty"`
	TokenType    string `json:"tokenType"`
	ExpiresIn    int    `json:"expiresIn"`
	Scope        string `json:"scope,omitempty"`
	Error        string `json:"error,omitempty"`
	ErrorDescription string `json:"errorDescription,omitempty"`
	ErrorURI     string `json:"errorUri,omitempty"`
	ExpiresAt    int64  `json:"expiresAt"`
}

type DeviceStart struct {
	DeviceCode             string `json:"deviceCode"`
	UserCode               string `json:"userCode"`
	VerificationURI        string `json:"verificationUri"`
	VerificationURIComplete string `json:"verificationUriComplete"`
	ExpiresIn              int    `json:"expiresIn"`
	Interval               int    `json:"interval"`
	Error                  string `json:"error,omitempty"`
	ErrorDescription       string `json:"errorDescription,omitempty"`
}

type DevicePoll struct {
	Status  string        `json:"status"` // success | pending | slow_down | denied | expired | error
	Token   *TokenResponse `json:"token,omitempty"`
	Message string        `json:"message,omitempty"`
}

type State struct {
	config       OAuth2Config
	codeVerifier string
	state        string
	httpClient   *http.Client
}

func New(config OAuth2Config) *State {
	return &State{
		config:     config,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func randString(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Token returns the current stored state value (used by the callback server
// to validate the state parameter on the redirect).
func (s *State) Token() string {
	if s == nil {
		return ""
	}
	return s.state
}

func (s *State) AuthorizeURL() (string, string, error) {
	state := randString(16)
	s.state = state
	authURL, err := url.Parse(s.config.AuthURL)
	if err != nil {
		return "", "", err
	}
	q := authURL.Query()
	q.Set("response_type", "code")
	q.Set("client_id", s.config.ClientID)
	q.Set("redirect_uri", s.config.RedirectURI)
	q.Set("state", state)
	if s.config.Scopes != "" {
		q.Set("scope", s.config.Scopes)
	}
	if s.config.UsePKCE {
		verifier := randString(32)
		s.codeVerifier = verifier
		hash := sha256.Sum256([]byte(verifier))
		challenge := base64.RawURLEncoding.EncodeToString(hash[:])
		q.Set("code_challenge", challenge)
		q.Set("code_challenge_method", "S256")
	}
	authURL.RawQuery = q.Encode()
	return authURL.String(), state, nil
}

// ValidateState returns true if the given state matches the one issued by
// AuthorizeURL, i.e. the callback genuinely originated from our request.
func (s *State) ValidateState(state string) bool {
	return s != nil && s.state != "" && s.state == state
}

func (s *State) Exchange(ctx context.Context, code string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", s.config.RedirectURI)
	data.Set("client_id", s.config.ClientID)
	if s.config.ClientSecret != "" {
		data.Set("client_secret", s.config.ClientSecret)
	}
	if s.config.UsePKCE && s.codeVerifier != "" {
		data.Set("code_verifier", s.codeVerifier)
	}
	tr, err := s.doToken(ctx, data)
	if err != nil {
		return nil, err
	}
	// A redirect_uri mismatch is reported by some providers as
	// bad_verification_code. Retry once without redirect_uri, which is the
	// documented fallback (GitHub uses the default registered callback URL).
	if tr.Error == "bad_verification_code" && s.config.RedirectURI != "" {
		alt := url.Values{}
		alt.Set("grant_type", "authorization_code")
		alt.Set("code", code)
		alt.Set("client_id", s.config.ClientID)
		if s.config.ClientSecret != "" {
			alt.Set("client_secret", s.config.ClientSecret)
		}
		if s.config.UsePKCE && s.codeVerifier != "" {
			alt.Set("code_verifier", s.codeVerifier)
		}
		if retry, rerr := s.doToken(ctx, alt); rerr == nil {
			tr = retry
		}
	}
	return tr, nil
}

func (s *State) Refresh(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)
	data.Set("client_id", s.config.ClientID)
	if s.config.ClientSecret != "" {
		data.Set("client_secret", s.config.ClientSecret)
	}
	return s.doToken(ctx, data)
}

// DeviceStart begins the OAuth 2.0 Device Authorization Grant (RFC 8628).
// It returns the user code to display and the verification URI to open.
// It posts to the device authorization endpoint, which is distinct from the
// token endpoint (e.g. GitHub: https://github.com/login/device/code).
func (s *State) DeviceStart(ctx context.Context) (*DeviceStart, error) {
	data := url.Values{}
	data.Set("client_id", s.config.ClientID)
	if s.config.ClientSecret != "" {
		data.Set("client_secret", s.config.ClientSecret)
	}
	if s.config.Scopes != "" {
		data.Set("scope", s.config.Scopes)
	}

	endpoint := s.config.DeviceURL
	if endpoint == "" {
		endpoint = s.config.TokenURL
	}
	body, err := s.post(ctx, endpoint, data)
	if err != nil {
		return nil, err
	}

	var raw struct {
		DeviceCode             string `json:"device_code"`
		UserCode               string `json:"user_code"`
		VerificationURI        string `json:"verification_uri"`
		VerificationURIComplete string `json:"verification_uri_complete"`
		ExpiresIn              int    `json:"expires_in"`
		Interval               int    `json:"interval"`
		Error                  string `json:"error"`
		ErrorDescription       string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse device start response: %w", err)
	}

	return &DeviceStart{
		DeviceCode:             raw.DeviceCode,
		UserCode:               raw.UserCode,
		VerificationURI:        raw.VerificationURI,
		VerificationURIComplete: raw.VerificationURIComplete,
		ExpiresIn:              raw.ExpiresIn,
		Interval:               raw.Interval,
		Error:                  raw.Error,
		ErrorDescription:       raw.ErrorDescription,
	}, nil
}

// DevicePoll polls the token endpoint for the device grant. The status field
// reflects the RFC 8628 lifecycle: success, pending, slow_down, denied,
// expired, or error.
func (s *State) DevicePoll(ctx context.Context, deviceCode string) (*DevicePoll, error) {
	data := url.Values{}
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
	data.Set("device_code", deviceCode)
	data.Set("client_id", s.config.ClientID)
	if s.config.ClientSecret != "" {
		data.Set("client_secret", s.config.ClientSecret)
	}

	body, err := s.post(ctx, s.config.TokenURL, data)
	if err != nil {
		return nil, err
	}

	var raw struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		Error        string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	// Providers return form-encoded when they ignore the Accept header; parse
	// either representation.
	if err := json.Unmarshal(body, &raw); err != nil || (raw.AccessToken == "" && raw.Error == "") {
		if vals, perr := url.ParseQuery(string(body)); perr == nil {
			raw.AccessToken = vals.Get("access_token")
			raw.RefreshToken = vals.Get("refresh_token")
			raw.TokenType = vals.Get("token_type")
			raw.Error = vals.Get("error")
			raw.ErrorDescription = vals.Get("error_description")
			fmt.Sscanf(vals.Get("expires_in"), "%d", &raw.ExpiresIn)
			raw.Scope = vals.Get("scope")
		}
	}

	if raw.AccessToken != "" {
		tr := &TokenResponse{
			AccessToken:  raw.AccessToken,
			RefreshToken: raw.RefreshToken,
			TokenType:    raw.TokenType,
			ExpiresIn:    raw.ExpiresIn,
			Scope:        raw.Scope,
		}
		if tr.ExpiresIn > 0 {
			tr.ExpiresAt = time.Now().Unix() + int64(tr.ExpiresIn)
		}
		return &DevicePoll{Status: "success", Token: tr}, nil
	}

	switch raw.Error {
	case "authorization_pending":
		return &DevicePoll{Status: "pending"}, nil
	case "slow_down":
		return &DevicePoll{Status: "slow_down"}, nil
	case "access_denied":
		return &DevicePoll{Status: "denied", Message: raw.ErrorDescription}, nil
	case "expired_token":
		return &DevicePoll{Status: "expired", Message: raw.ErrorDescription}, nil
	default:
		msg := raw.Error
		if raw.ErrorDescription != "" {
			msg += ": " + raw.ErrorDescription
		}
		return &DevicePoll{Status: "error", Message: msg}, nil
	}
}

func (s *State) doToken(ctx context.Context, data url.Values) (*TokenResponse, error) {
	body, err := s.post(ctx, s.config.TokenURL, data)
	if err != nil {
		return nil, err
	}

	var raw struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		Error        string `json:"error"`
		ErrorDescription string `json:"error_description"`
		ErrorURI     string `json:"error_uri"`
	}
	// JSON is the preferred response (we send Accept: application/json). Some
	// providers still reply with application/x-www-form-urlencoded; detect and
	// parse that too so GitHub-style flows always work.
	if err := json.Unmarshal(body, &raw); err != nil || (raw.AccessToken == "" && raw.Error == "") {
		if vals, perr := url.ParseQuery(string(body)); perr == nil {
			raw.AccessToken = vals.Get("access_token")
			raw.RefreshToken = vals.Get("refresh_token")
			raw.TokenType = vals.Get("token_type")
			raw.Error = vals.Get("error")
			raw.ErrorDescription = vals.Get("error_description")
			raw.ErrorURI = vals.Get("error_uri")
			fmt.Sscanf(vals.Get("expires_in"), "%d", &raw.ExpiresIn)
			raw.Scope = vals.Get("scope")
		}
	}

	tr := &TokenResponse{
		AccessToken:      raw.AccessToken,
		RefreshToken:     raw.RefreshToken,
		TokenType:        raw.TokenType,
		ExpiresIn:        raw.ExpiresIn,
		Scope:            raw.Scope,
		Error:            raw.Error,
		ErrorDescription: raw.ErrorDescription,
		ErrorURI:         raw.ErrorURI,
	}
	if tr.ExpiresIn > 0 {
		tr.ExpiresAt = time.Now().Unix() + int64(tr.ExpiresIn)
	}
	return tr, nil
}

// post sends a form-encoded POST to the given endpoint and returns the raw
// response body. It always requests JSON so GitHub and friends reply with JSON
// instead of the default form-encoded token payload.
func (s *State) post(ctx context.Context, endpoint string, data url.Values) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return body, nil
}
