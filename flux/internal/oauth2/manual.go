package oauth2

import (
	"context"
	"fmt"
	"net/url"
)

// ManualFlow is the Postman-style paste-back fallback (RedirectManual): no
// loopback listener is bound. The authorize URL is shown to the user, they
// complete login in any browser, and paste the resulting redirect URL back
// into reqit. Complete parses the URL, validates state, and exchanges the
// code with the flow's PKCE verifier.
//
// This is the path for environments where a local listener cannot bind or the
// provider rejects loopback redirect URIs — the code still travels through the
// engine's AuthCodeFlow, so state validation and PKCE are enforced exactly as
// in the loopback path.
type ManualFlow struct {
	flow *AuthCodeFlow
}

// NewManualFlow prepares an authorization_code + PKCE flow for manual
// paste-back completion. Only authorization_code is supported (the grant that
// has a code to paste); device/other grants have no redirect to paste.
func NewManualFlow(cfg OAuthConfig) (*ManualFlow, error) {
	f, err := NewAuthCodeFlow(cfg)
	if err != nil {
		return nil, err
	}
	return &ManualFlow{flow: f}, nil
}

// WithClientSecret threads a confidential client's secret into the code
// exchange (RFC 6749 §2.3). It is transient for the flow's lifetime and only
// ever sent when the config marks the client Confidential — never in a PKCE
// public-client exchange.
func (m *ManualFlow) WithClientSecret(secret string) *ManualFlow {
	m.flow.WithClientSecret(secret)
	return m
}

// State returns the state bound to this flow's authorize request.
func (m *ManualFlow) State() string { return m.flow.State() }

// Config returns the flow's (secret-free) configuration.
func (m *ManualFlow) Config() OAuthConfig { return m.flow.Config() }

// AuthorizeURL builds the authorization endpoint URL with response_type=code,
// state, and the PKCE challenge. Show it to the user so they can complete
// login in their browser.
func (m *ManualFlow) AuthorizeURL() (string, error) { return m.flow.AuthorizeURL() }

// Complete validates the pasted redirect URL and exchanges the code for a
// token. It returns typed errors: ErrStateMismatch when the provider's state
// doesn't match this request, ErrProviderDenied with the verbatim provider
// error/error_description when the provider rejected the request, and
// InvalidConfigError when the pasted value carries no code.
func (m *ManualFlow) Complete(ctx context.Context, pasted string) (*TokenResult, error) {
	if pasted == "" {
		return nil, InvalidConfigError("manual_complete", "paste the redirect URL from your browser's address bar")
	}
	u, err := url.Parse(pasted)
	if err != nil {
		return nil, InvalidConfigError("manual_complete", fmt.Sprintf("the pasted value is not a URL: %v", err))
	}

	// Authorization-code responses put the code in the query string. A pasted
	// URL may include a fragment (Implicit-style delivery or a provider that
	// appends both), so fall back to parsing the fragment too.
	q := u.Query()
	code := q.Get("code")
	state := q.Get("state")
	if code == "" {
		if frag, perr := url.ParseQuery(u.Fragment); perr == nil {
			if code == "" {
				code = frag.Get("code")
			}
			if state == "" {
				state = frag.Get("state")
			}
		}
	}

	// Surface provider rejections verbatim (RFC 6749 §4.1.2.1) before
	// touching state validation — the user must see the provider's message.
	if q.Get("error") != "" {
		return nil, ProviderDeniedError("manual_complete", &ProviderError{
			Code:        q.Get("error"),
			Description: q.Get("error_description"),
			URI:         q.Get("error_uri"),
		})
	}
	if state == "" {
		return nil, MissingCallbackError("manual_complete")
	}
	if !m.flow.ValidateState(state) {
		return nil, StateMismatchError("manual_complete")
	}
	if code == "" {
		return nil, InvalidConfigError("manual_complete", "no authorization code found in the pasted redirect URL")
	}
	return m.flow.ExchangeCode(ctx, code)
}
