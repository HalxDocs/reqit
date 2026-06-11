package models

type Header struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	Enabled   bool   `json:"enabled"`
	ValueType string `json:"valueType,omitempty"` // "text" | "file"
}

type RequestPayload struct {
	Method    string   `json:"method"`
	URL       string   `json:"url"`
	Headers   []Header `json:"headers"`
	Params    []Header `json:"params"`
	BodyType  string   `json:"bodyType"`  // "none"|"json"|"form"|"urlencoded"|"graphql"
	Body      string   `json:"body"`
	BodyForm  []Header `json:"bodyForm"`  // for form / urlencoded modes
	AuthType  string   `json:"authType"`  // "none"|"bearer"|"basic"
	AuthValue string   `json:"authValue"` // token or "user:pass"
	SpecPath  string   `json:"specPath"`  // optional, relative to workspace root
	GraphQLQuery     string   `json:"graphqlQuery"`
	GraphQLVariables string   `json:"graphqlVariables"`
	PreScript        string   `json:"preScript"`
	PostScript       string   `json:"postScript"`
}

type CookieSummary struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Expires  string `json:"expires"`
	HttpOnly bool   `json:"httpOnly"`
	Secure   bool   `json:"secure"`
}

type ValidationError struct {
	Layer   string `json:"layer"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationResult struct {
	Valid      bool              `json:"valid"`
	Errors     []ValidationError `json:"errors"`
	SkipReason string            `json:"skipReason"`
	Endpoint   string            `json:"endpoint"`
	Method     string            `json:"method"`
}

type TimingBreakdown struct {
	DNSLookupMs    int64 `json:"dnsLookupMs"`
	TCPConnectMs   int64 `json:"tcpConnectMs"`
	TLSHandshakeMs int64 `json:"tlsHandshakeMs"`
	TTFBMs         int64 `json:"ttfbMs"`
	DownloadMs     int64 `json:"downloadMs"`
	TotalMs        int64 `json:"totalMs"`
}

type ResponseResult struct {
	Status        string            `json:"status"`
	StatusCode    int               `json:"statusCode"`
	Headers       map[string]string `json:"headers"`
	Body          string            `json:"body"`
	BodyIsBase64  bool              `json:"bodyIsBase64"`
	TimingMs      int64             `json:"timingMs"`
	Timing        *TimingBreakdown  `json:"timing,omitempty"`
	SizeBytes     int64             `json:"sizeBytes"`
	Error         string            `json:"error"`
	Cookies       []CookieSummary   `json:"cookies"`
	Validation    *ValidationResult `json:"validation,omitempty"`
}

type SavedResponse struct {
	StatusCode  int               `json:"statusCode"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	CapturedAt  string            `json:"capturedAt"`
}

type MockOverride struct {
	Enabled    bool   `json:"enabled"`
	StatusCode int    `json:"statusCode"`
	DelayMs    int    `json:"delayMs"`
	Body       string `json:"body"`
}

type SavedRequest struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	CollID       string         `json:"collectionId"`
	Payload      RequestPayload `json:"payload"`
	CreatedAt    string         `json:"createdAt"`
	SavedResponse *SavedResponse `json:"savedResponse,omitempty"`
	MockOverride  *MockOverride  `json:"mockOverride,omitempty"`
	PreSetVars    []PreSetVar    `json:"preSetVars,omitempty"`
	ExtractRules  []ExtractRule  `json:"extractRules,omitempty"`
}

type Collection struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	SpecPath string         `json:"spec,omitempty"` // optional OpenAPI spec path relative to workspace
	Requests []SavedRequest `json:"requests"`
}

type EnvVar struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type Environment struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Vars []EnvVar `json:"vars"`
}

type HistoryEntry struct {
	ID        string         `json:"id"`
	Payload   RequestPayload `json:"payload"`
	Response  ResponseResult `json:"response"`
	CreatedAt string         `json:"createdAt"`
}

// --- Scripting ---

type PreSetVar struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type ExtractRule struct {
	ID     string `json:"id"`
	Type   string `json:"type"`   // "body_json" | "header"
	Source string `json:"source"` // JSON path like "data.id" or header name
	Target string `json:"target"` // env var name to set
}

// --- Collection Runner ---

type Assertion struct {
	StatusCode   int    `json:"statusCode,omitempty"`
	MaxTimingMs  int64  `json:"maxTimingMs,omitempty"`
	BodyContains string `json:"bodyContains,omitempty"`
}

type RunnerRequest struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Payload      RequestPayload `json:"payload"`
	PreSetVars   []PreSetVar    `json:"preSetVars,omitempty"`
	ExtractRules []ExtractRule  `json:"extractRules,omitempty"`
}

type RequestRunResult struct {
	RequestID       string   `json:"requestId"`
	RequestName     string   `json:"requestName"`
	Passed          bool     `json:"passed"`
	StatusCode      int      `json:"statusCode"`
	StatusText      string   `json:"statusText"`
	TimingMs        int64    `json:"timingMs"`
	SizeBytes       int64    `json:"sizeBytes"`
	Error           string   `json:"error"`
	AssertionErrors []string `json:"assertionErrors"`
}

type CollectionRunResult struct {
	CollectionID   string             `json:"collectionId"`
	CollectionName string             `json:"collectionName"`
	Results        []RequestRunResult `json:"results"`
	Passed         int                `json:"passed"`
	Failed         int                `json:"failed"`
	Total          int                `json:"total"`
	DurationMs     int64              `json:"durationMs"`
}

// --- WebSocket / SSE ---

type SocketMessage struct {
	Timestamp int64  `json:"timestamp"`
	Direction string `json:"direction"` // "sent" | "received"
	Body      string `json:"body"`
}

type SocketState struct {
	Status   string          `json:"status"`   // "disconnected" | "connecting" | "connected" | "error"
	Protocol string          `json:"protocol"` // "ws" | "sse"
	URL      string          `json:"url"`
	Messages []SocketMessage `json:"messages"`
}
