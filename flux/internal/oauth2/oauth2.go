package oauth2

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OAuth2Config struct {
	AuthURL      string `json:"authUrl"`
	TokenURL     string `json:"tokenUrl"`
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
	ExpiresAt    int64  `json:"expiresAt"`
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

func (s *State) AuthorizeURL() (string, string, error) {
	state := randString(16)
	s.state = state
	authURL, _ := url.Parse(s.config.AuthURL)
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

	req, err := http.NewRequestWithContext(ctx, "POST", s.config.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var raw struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		Error        string `json:"error"`
	}
	json.Unmarshal(body, &raw)

	tr := &TokenResponse{
		AccessToken:  raw.AccessToken,
		RefreshToken: raw.RefreshToken,
		TokenType:    raw.TokenType,
		ExpiresIn:    raw.ExpiresIn,
		Scope:        raw.Scope,
		Error:        raw.Error,
	}
	if tr.ExpiresIn > 0 {
		tr.ExpiresAt = time.Now().Unix() + int64(tr.ExpiresIn)
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

	req, err := http.NewRequestWithContext(ctx, "POST", s.config.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var raw struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		Error        string `json:"error"`
	}
	json.Unmarshal(body, &raw)

	tr := &TokenResponse{
		AccessToken:  raw.AccessToken,
		RefreshToken: raw.RefreshToken,
		TokenType:    raw.TokenType,
		ExpiresIn:    raw.ExpiresIn,
		Error:        raw.Error,
	}
	if tr.ExpiresIn > 0 {
		tr.ExpiresAt = time.Now().Unix() + int64(tr.ExpiresIn)
	}
	return tr, nil
}
