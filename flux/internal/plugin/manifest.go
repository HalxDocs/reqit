package plugin

// Manifest describes a reqit plugin.
type Manifest struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Hooks       Hooks  `json:"hooks"`
}

// Hooks declares which lifecycle points the plugin attaches to.
type Hooks struct {
	AuthProvider   string `json:"authProvider,omitempty"`   // JS file that exports an auth function
	Visualizer     string `json:"visualizer,omitempty"`     // JS file that exports a visualizer function
	Codegen        string `json:"codegen,omitempty"`        // JS file that exports a codegen function
	PreRequest     string `json:"preRequest,omitempty"`     // JS file that exports a pre-request hook
	PostRequest    string `json:"postRequest,omitempty"`    // JS file that exports a post-request hook
	MockRule       string `json:"mockRule,omitempty"`       // JS file that exports a mock rule evaluator
}

// RegisteredPlugin is a loaded and validated plugin.
type RegisteredPlugin struct {
	Manifest Manifest `json:"manifest"`
	Dir      string   `json:"dir"`
}
