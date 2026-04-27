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
}

type ResponseResult struct {
	Status     string            `json:"status"`
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	TimingMs   int64             `json:"timingMs"`
	SizeBytes  int64             `json:"sizeBytes"`
	Error      string            `json:"error"`
}

type SavedRequest struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	CollID    string         `json:"collectionId"`
	Payload   RequestPayload `json:"payload"`
	CreatedAt string         `json:"createdAt"`
}

type Collection struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
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
