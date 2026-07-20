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
	BodyType  string   `json:"bodyType"`  // "none"|"json"|"form"|"urlencoded"|"graphql"|"grpc"|"soap"
	Body      string   `json:"body"`
	BodyForm  []Header `json:"bodyForm"`  // for form / urlencoded modes
	AuthType  string   `json:"authType"`  // "none"|"bearer"|"basic"|"digest"|"ntlm"|"oauth2"|"token"
	AuthValue string   `json:"authValue"` // token, "user:pass", or oauth2 config JSON
	SpecPath  string   `json:"specPath"`  // optional, relative to workspace root
	GraphQLQuery     string   `json:"graphqlQuery"`
	GraphQLVariables string   `json:"graphqlVariables"`
	PreScript        string   `json:"preScript"`
	PostScript       string   `json:"postScript"`
	Notes            string   `json:"notes,omitempty"`
	// Protocol-specific
	GRPCService string `json:"grpcService,omitempty"`
	GRPCMethod  string `json:"grpcMethod,omitempty"`
	MQTTTopic   string `json:"mqttTopic,omitempty"`
	SOAPAction  string `json:"soapAction,omitempty"`
	SOAPVersion string `json:"soapVersion,omitempty"` // "1.1" | "1.2"
	// mTLS client certificate
	ClientCert string `json:"clientCert,omitempty"` // PEM-encoded certificate
	ClientKey  string `json:"clientKey,omitempty"`  // PEM-encoded private key
	Timeout    int    `json:"timeout,omitempty"`     // seconds, 0 = default (30s)
}

// OAuth2Config stored as JSON in AuthValue when AuthType=="oauth2"
type OAuth2Config struct {
	AuthURL      string `json:"authUrl"`
	TokenURL     string `json:"tokenUrl"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Scopes       string `json:"scopes"`
	RedirectURI  string `json:"redirectUri"`
	UsePKCE      bool   `json:"usePkce"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
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
	Notes        string         `json:"notes,omitempty"`
	CollID       string         `json:"collectionId"`
	Payload      RequestPayload `json:"payload"`
	CreatedAt    string         `json:"createdAt"`
	SavedResponse *SavedResponse `json:"savedResponse,omitempty"`
	MockOverride  *MockOverride  `json:"mockOverride,omitempty"`
	PreSetVars    []PreSetVar    `json:"preSetVars,omitempty"`
	ExtractRules  []ExtractRule  `json:"extractRules,omitempty"`
}

type Collection struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	SpecPath    string         `json:"spec,omitempty"` // optional OpenAPI spec path relative to workspace
	Public      bool           `json:"public,omitempty"`
	Variables   []EnvVar       `json:"variables,omitempty"` // collection-scoped variables
	Requests    []SavedRequest `json:"requests"`
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
	Tags      []string       `json:"tags,omitempty"`
	Favorite  bool           `json:"favorite"`
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

type AssertionType string

const (
	AssertStatusCode     AssertionType = "statusCode"
	AssertMaxTiming     AssertionType = "maxTiming"
	AssertBodyContains  AssertionType = "bodyContains"
	AssertBodyMatch     AssertionType = "bodyMatch"      // regex match
	AssertBodyNotMatch  AssertionType = "bodyNotMatch"   // regex not match
	AssertJSONPath      AssertionType = "jsonPath"       // JSON path value comparison
	AssertHeader        AssertionType = "header"         // header value check
	AssertCookie        AssertionType = "cookie"         // cookie value check
	AssertVarEqual      AssertionType = "varEqual"       // variable-to-variable equality
	AssertVarNotEqual   AssertionType = "varNotEqual"    // variable-to-variable inequality
	AssertJSONSchema    AssertionType = "jsonSchema"     // JSON Schema validation
	AssertCustomScript  AssertionType = "customScript"   // custom JS assertion
)

type Assertion struct {
	Type   AssertionType `json:"type"`
	Target string        `json:"target"` // header name, cookie name, JSON path, regex, var name, schema JSON
	Value  string        `json:"value,omitempty"` // expected value (empty for schema/script)
	Script string        `json:"script,omitempty"` // custom JS assertion script

	// Legacy fields (kept for backward compatibility with existing runner modal)
	StatusCode     int   `json:"statusCode,omitempty"`
	MaxTimingMs    int64 `json:"maxTimingMs,omitempty"`
	BodyContains   string `json:"bodyContains,omitempty"`
}

type RunnerRequest struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Payload      RequestPayload `json:"payload"`
	PreSetVars   []PreSetVar    `json:"preSetVars,omitempty"`
	ExtractRules []ExtractRule  `json:"extractRules,omitempty"`
	Assertions   []Assertion    `json:"assertions,omitempty"`
	Retries      int            `json:"retries,omitempty"`      // retry up to N times on failure
	Condition    string         `json:"condition,omitempty"`   // JS condition to decide whether to run
}

type RunnerConfig struct {
	Requests         []RunnerRequest            `json:"requests"`
	Env              map[string]string          `json:"env,omitempty"`
	MaxConcurrent    int                        `json:"maxConcurrent,omitempty"`    // semaphore size for concurrent runner (default 5)
	Concurrency      int                        `json:"concurrency,omitempty"`      // max VUs for load test
	RampUp           int                        `json:"rampUp,omitempty"`           // ramp-up duration in seconds
	Iterations       int                        `json:"iterations,omitempty"`       // iterations per VU
	RetryDelayMs     int                        `json:"retryDelayMs,omitempty"`
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
	Retries         int      `json:"retries,omitempty"`
	Skipped         bool     `json:"skipped,omitempty"`
}

type CollectionRunResult struct {
	CollectionID   string             `json:"collectionId"`
	CollectionName string             `json:"collectionName"`
	Results        []RequestRunResult `json:"results"`
	Passed         int                `json:"passed"`
	Failed         int                `json:"failed"`
	Skipped        int                `json:"skipped"`
	Total          int                `json:"total"`
	DurationMs     int64              `json:"durationMs"`
}

// --- Test Suites / Visual Test Builder ---

type TestSuite struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Groups      []TestGroup  `json:"groups"`
	CollID      string       `json:"collectionId,omitempty"`
}

type TestGroup struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	RequestID string   `json:"requestId"` // references a SavedRequest or RunnerRequest
	Assertions []Assertion `json:"assertions"`
	Children  []TestGroup `json:"children,omitempty"` // nested groups
}

// --- Load / Performance Testing ---

type LoadTestConfig struct {
	Request     RequestPayload `json:"request"`
	VUs         int            `json:"vus"`         // virtual users
	DurationSec int            `json:"durationSec"` // test duration
	RampUpSec   int            `json:"rampUpSec"`   // ramp-up time
	Iterations  int            `json:"iterations"`  // total iterations (0 = run for duration)
	Env         map[string]string `json:"env,omitempty"`
}

type LoadTestSample struct {
	TimestampMs int64 `json:"timestampMs"`
	StatusCode  int   `json:"statusCode"`
	TimingMs    int64 `json:"timingMs"`
	SizeBytes   int64 `json:"sizeBytes"`
	Error       bool  `json:"error"`
}

type LoadTestResult struct {
	Config     LoadTestConfig    `json:"config"`
	Samples    []LoadTestSample  `json:"samples"`
	TotalReqs  int               `json:"totalReqs"`
	Passed     int               `json:"passed"`
	Failed     int               `json:"failed"`
	AvgTimingMs float64          `json:"avgTimingMs"`
	P50TimingMs float64          `json:"p50TimingMs"`
	P95TimingMs float64          `json:"p95TimingMs"`
	P99TimingMs float64          `json:"p99TimingMs"`
	DurationMs int64             `json:"durationMs"`
	Error      string            `json:"error,omitempty"`
}

// --- Reports ---

type ReportSection string

const (
	ReportSummary  ReportSection = "summary"
	ReportRequests ReportSection = "requests"
	ReportLoadTest ReportSection = "loadTest"
	ReportFailures ReportSection = "failures"
)

type TestReport struct {
	Title          string                `json:"title"`
	CreatedAt      string                `json:"createdAt"`
	RunResult      *CollectionRunResult  `json:"runResult,omitempty"`
	LoadResult     *LoadTestResult       `json:"loadResult,omitempty"`
	Sections       []ReportSection       `json:"sections"`
	HTML           string                `json:"html,omitempty"` // rendered HTML report
}

// --- External Runner Compliance ---

type ExternalRunnerConfig struct {
	Type            string `json:"type"`            // "playwright" | "jest" | "cli"
	CollectionID    string `json:"collectionId"`
	OutputDir       string `json:"outputDir"`
	GenerateTestFile bool  `json:"generateTestFile"`
	TestFilePath    string `json:"testFilePath,omitempty"`
}

// --- OAuth2 ---

type OAuth2TokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	TokenType    string `json:"tokenType"`
	ExpiresIn    int    `json:"expiresIn"`
	ExpiresAt    int64  `json:"expiresAt"`
	Error        string `json:"error,omitempty"`
}

// --- JWT ---

type JWTDecoded struct {
	Header  map[string]interface{} `json:"header"`
	Claims  map[string]interface{} `json:"claims"`
	Valid   bool                   `json:"valid"`
	Expired bool                   `json:"expired"`
	Error   string                 `json:"error,omitempty"`
}

// --- gRPC ---

type GRPCResponse struct {
	StatusCode int               `json:"statusCode"`
	Body       string            `json:"body"`
	Error      string            `json:"error,omitempty"`
	DurationMs int64             `json:"durationMs"`
	Headers    map[string]string `json:"headers"`
}

// --- WebSocket / SSE / Socket.IO ---

type SocketMessage struct {
	Timestamp int64  `json:"timestamp"`
	Direction string `json:"direction"` // "sent" | "received"
	Body      string `json:"body"`
	EventType string `json:"eventType,omitempty"`
	EventID   string `json:"eventId,omitempty"`
	Retry     int    `json:"retry,omitempty"`
}

type SocketState struct {
	Status   string          `json:"status"`   // "disconnected" | "connecting" | "connected" | "error"
	Protocol string          `json:"protocol"` // "ws" | "sse" | "socketio"
	URL      string          `json:"url"`
	Messages []SocketMessage `json:"messages"`
}

type SocketIOConnectRequest struct {
	URL     string            `json:"url"`
	Cookies string            `json:"cookies"`
	Headers map[string]string `json:"headers"`
}
