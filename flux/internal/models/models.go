package models

type Header struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type RequestPayload struct {
	Method    string   `json:"method"`
	URL       string   `json:"url"`
	Headers   []Header `json:"headers"`
	Params    []Header `json:"params"`
	BodyType  string   `json:"bodyType"`  // "none"|"json"|"form"|"urlencoded"
	Body      string   `json:"body"`
	BodyForm  []Header `json:"bodyForm"`  // for form / urlencoded modes
	AuthType  string   `json:"authType"`  // "none"|"bearer"|"basic"
	AuthValue string   `json:"authValue"` // token or "user:pass"
	SpecPath  string   `json:"specPath"`  // optional, relative to workspace root
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

type ResponseResult struct {
	Status     string            `json:"status"`
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	TimingMs   int64             `json:"timingMs"`
	SizeBytes  int64             `json:"sizeBytes"`
	Error      string            `json:"error"`
	Cookies    []CookieSummary   `json:"cookies"`
	Validation *ValidationResult `json:"validation,omitempty"`
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
