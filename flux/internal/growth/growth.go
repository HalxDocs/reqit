package growth

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// 1. Open-core / Tier definitions (matching Bruno's Golden Edition blueprint)
// ---------------------------------------------------------------------------

type Tier string

const (
	TierOSS       Tier = "oss"
	TierPro       Tier = "pro"
	TierEnterprise Tier = "enterprise"
)

type FeatureTier struct {
	Feature       string `json:"feature"`
	OSS           bool   `json:"oss"`
	Pro           bool   `json:"pro"`
	Enterprise    bool   `json:"enterprise"`
	Category      string `json:"category"`
	Description   string `json:"description"`
}

// DefaultFeatureTiers defines the open-core boundary — what is free vs paid.
var DefaultFeatureTiers = []FeatureTier{
	// — HTTP Client Core —
	{Feature: "HTTP/HTTPS requests", OSS: true, Pro: true, Enterprise: true, Category: "Core", Description: "Send HTTP/HTTPS requests with full control"},
	{Feature: "Multiple tabbed requests", OSS: true, Pro: true, Enterprise: true, Category: "Core", Description: "Work with many requests at once"},
	{Feature: "Environment variables", OSS: true, Pro: true, Enterprise: true, Category: "Core", Description: "Templated variables per environment"},
	{Feature: "Collection grouping", OSS: true, Pro: true, Enterprise: true, Category: "Core", Description: "Organise requests into collections"},
	{Feature: "Pre-request & post-response scripts", OSS: true, Pro: true, Enterprise: true, Category: "Scripting", Description: "JS scripting via goja"},
	{Feature: "cURL import/export", OSS: true, Pro: true, Enterprise: true, Category: "Interop", Description: "Import from and export to cURL"},
	{Feature: "History & replay", OSS: true, Pro: true, Enterprise: true, Category: "Core", Description: "Full request history with replay"},

	// — Protocols —
	{Feature: "WebSocket / SSE client", OSS: true, Pro: true, Enterprise: true, Category: "Protocols", Description: "Real-time protocol testing"},
	{Feature: "gRPC client", OSS: false, Pro: true, Enterprise: true, Category: "Protocols", Description: "gRPC unary & streaming calls"},
	{Feature: "MQTT client", OSS: false, Pro: true, Enterprise: true, Category: "Protocols", Description: "MQTT publish/subscribe"},
	{Feature: "SOAP client", OSS: false, Pro: true, Enterprise: true, Category: "Protocols", Description: "SOAP XML request support"},

	// — Advanced Features —
	{Feature: "OpenAPI import/export", OSS: true, Pro: true, Enterprise: true, Category: "Interop", Description: "Bidirectional OpenAPI 3 spec sync"},
	{Feature: "Postman collection import", OSS: true, Pro: true, Enterprise: true, Category: "Interop", Description: "Full Postman v2.1 import"},
	{Feature: "Insomnia / Hoppscotch import/export", OSS: true, Pro: true, Enterprise: true, Category: "Interop", Description: "Cross-tool migration support"},
	{Feature: "Visual API designer", OSS: true, Pro: true, Enterprise: true, Category: "Design", Description: "Design APIs visually with spec editor"},
	{Feature: "Auto-generated API docs", OSS: true, Pro: true, Enterprise: true, Category: "Design", Description: "Live API reference docs"},
	{Feature: "Mock server (rules engine)", OSS: false, Pro: true, Enterprise: true, Category: "Testing", Description: "Stateful mock with rule-based responses"},
	{Feature: "Test suite builder", OSS: false, Pro: true, Enterprise: true, Category: "Testing", Description: "Multi-step integration test builder"},
	{Feature: "Load testing", OSS: false, Pro: true, Enterprise: true, Category: "Testing", Description: "Basic load/performance testing"},
	{Feature: "Assertion editor", OSS: false, Pro: true, Enterprise: true, Category: "Testing", Description: "Response assertions with JSON path"},

	// — Collaboration —
	{Feature: "Git-native sync (commit/push/pull)", OSS: true, Pro: true, Enterprise: true, Category: "Collab", Description: "Version-controlled collections via Git"},
	{Feature: "Team workspaces", OSS: false, Pro: true, Enterprise: true, Category: "Collab", Description: "Shared workspaces with team members"},
	{Feature: "Role-based access control (RBAC)", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "Granular permissions per user"},
	{Feature: "Audit trail", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "Full activity audit log"},
	{Feature: "SSO (SAML / OIDC)", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "Enterprise single sign-on"},
	{Feature: "E2EE (AES-256-GCM)", OSS: false, Pro: true, Enterprise: true, Category: "Security", Description: "End-to-end encrypted secrets"},
	{Feature: "Secret vault integrations", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "1Password, Vault, AWS Secrets Manager"},
	{Feature: "Data masking", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "Dynamic masking of sensitive data"},
	{Feature: "Air-gapped deployment", OSS: false, Pro: false, Enterprise: true, Category: "Enterprise", Description: "Fully offline operation"},

	// — Integrations —
	{Feature: "CI/CD pipeline generation", OSS: true, Pro: true, Enterprise: true, Category: "Integrations", Description: "Generate GitHub Actions / GitLab CI / Jenkins"},
	{Feature: "SwaggerHub / Stoplight push/pull", OSS: true, Pro: true, Enterprise: true, Category: "Integrations", Description: "External registry sync"},
	{Feature: "Browser traffic interceptor", OSS: true, Pro: true, Enterprise: true, Category: "Integrations", Description: "Capture browser traffic as requests"},
	{Feature: "Plugin system (JS)", OSS: false, Pro: true, Enterprise: true, Category: "Extensibility", Description: "Custom plugins in JavaScript"},
	{Feature: "Code generation (multi-lang)", OSS: true, Pro: true, Enterprise: true, Category: "Integrations", Description: "Generate code snippets in 10+ languages"},

	// — Support —
	{Feature: "Community support (Discord / GitHub)", OSS: true, Pro: true, Enterprise: true, Category: "Support", Description: "Community-driven help"},
	{Feature: "Priority email support", OSS: false, Pro: true, Enterprise: true, Category: "Support", Description: "24h response SLA"},
	{Feature: "Dedicated account manager", OSS: false, Pro: false, Enterprise: true, Category: "Support", Description: "Named support contact"},
	{Feature: "Custom enterprise SLA", OSS: false, Pro: false, Enterprise: true, Category: "Support", Description: "Custom uptime and support terms"},
}

// ---------------------------------------------------------------------------
// 2. Documentation & recipes (cookbooks)
// ---------------------------------------------------------------------------

type Recipe struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Steps       []Step   `json:"steps"`
	Tags        []string `json:"tags"`
}

type Step struct {
	Order       int    `json:"order"`
	Title       string `json:"title"`
	Instruction string `json:"instruction"`
	Code        string `json:"code,omitempty"`
	Expected    string `json:"expected,omitempty"`
}

// DefaultRecipes returns the built-in cookbook library.
func DefaultRecipes() []Recipe {
	return []Recipe{
		{
			ID: "chained-auth", Title: "Chained Authentication Request Loop",
			Category: "Authentication", Description: "Extract a token from one endpoint and reuse it across subsequent requests using pre-request scripting.",
			Tags: []string{"auth", "token", "chaining", "intermediate"},
			Steps: []Step{
				{Order: 1, Title: "Create the auth request", Instruction: "Create a new POST request to your auth endpoint (e.g., /auth/token). Add form-encoded body with client_id, client_secret, and grant_type=client_credentials."},
				{Order: 2, Title: "Add post-response script", Instruction: "In the 'Scripts' tab, add a post-response script that extracts the token from the response body and stores it in an environment variable:", Code: "const resp = JSON.parse(responseBody);\nreqit.setEnvVar('access_token', resp.access_token);"},
				{Order: 3, Title: "Create the authenticated request", Instruction: "Create a second request. In the 'Auth' tab, select Bearer Token and use {{access_token}} as the token value."},
				{Order: 4, Title: "Run in sequence", Instruction: "Use the Collection Runner (or test suite) to run the auth request first, then the authenticated request. The token will automatically populate."},
				{Order: 5, Title: "Verify", Instruction: "Check that the second request returns 200 with the expected data, confirming the token chaining works.", Expected: "Second request returns 200 OK."},
			},
		},
		{
			ID: "oauth2-pkce", Title: "OAuth 2.0 Authorization Code + PKCE Flow",
			Category: "Authentication", Description: "Simulate the full OAuth2 PKCE flow using pre-request scripts: generate code_verifier, code_challenge, and exchange the auth code.",
			Tags: []string{"auth", "oauth2", "pkce", "advanced"},
			Steps: []Step{
				{Order: 1, Title: "Generate PKCE values", Instruction: "In a pre-request script, generate a code_verifier and code_challenge using crypto:", Code: "const verifier = reqit.randomBytes(32).then(b => reqit.base64URL(b));\nreqit.setEnvVar('code_verifier', verifier);\nconst challenge = reqit.sha256(verifier).then(h => reqit.base64URL(h));\nreqit.setEnvVar('code_challenge', challenge);"},
				{Order: 2, Title: "Build the authorize URL", Instruction: "Construct the authorization URL with the code_challenge parameter. Use your browser or the Interceptor to complete the user-facing redirect.", Code: "const base = 'https://auth.example.com/authorize';\nconst params = new URLSearchParams({\n  response_type: 'code',\n  client_id: '{{client_id}}',\n  redirect_uri: '{{redirect_uri}}',\n  code_challenge: '{{code_challenge}}',\n  code_challenge_method: 'S256',\n});\nreqit.log(`${base}?${params}`);"},
				{Order: 3, Title: "Exchange the code", Instruction: "Create a POST request to the /token endpoint. Set body type to form-urlencoded with grant_type=authorization_code, code={{auth_code}}, and code_verifier={{code_verifier}}."},
				{Order: 4, Title: "Store the tokens", Instruction: "Add a post-response script to extract access_token and refresh_token from the response.", Code: "const t = JSON.parse(responseBody);\nreqit.setEnvVar('access_token', t.access_token);\nreqit.setEnvVar('refresh_token', t.refresh_token);"},
				{Order: 5, Title: "Use the token", Instruction: "Now use {{access_token}} in the Authorization header of any subsequent API request.", Expected: "Token exchange succeeds with 200."},
			},
		},
		{
			ID: "env-switching", Title: "Environment Switching for Multi-Stage Deployments",
			Category: "Environment", Description: "Efficiently switch between dev, staging, and production environments without changing request data.",
			Tags: []string{"environment", "devops", "deployment"},
			Steps: []Step{
				{Order: 1, Title: "Create environments", Instruction: "In the Environments modal, create three environments: 'Development', 'Staging', and 'Production'. Add shared variables like base_url, api_key, and timeout to each."},
				{Order: 2, Title: "Use variables in requests", Instruction: "Replace hardcoded values in your requests with {{variable}} placeholders. E.g., set URL to {{base_url}}/api/v1/users."},
				{Order: 3, Title: "Switch and test", Instruction: "Use the environment switcher in the sidebar to toggle between environments. The same request will now target different servers."},
				{Order: 4, Title: "Export for CI/CD", Instruction: "Use the CLI runner template (Integrations panel) to export environment-specific run scripts.", Expected: "Same request works across all environments."},
			},
		},
		{
			ID: "mock-stateful", Title: "Stateful Mock Server for Testing",
			Category: "Mocking", Description: "Create a mock server that simulates stateful API behaviour (e.g., create a resource then retrieve it).",
			Tags: []string{"mock", "testing", "stateful"},
			Steps: []Step{
				{Order: 1, Title: "Enable mock server", Instruction: "Navigate to the Mock panel and start the mock server. Note the port number."},
				{Order: 2, Title: "Create a stateful rule", Instruction: "Add a POST /items rule that stores the request body in the mock's state store and returns 201 with the stored object."},
				{Order: 3, Title: "Create a retrieval rule", Instruction: "Add a GET /items/:id rule that looks up the previously stored item and returns it. If not found, return 404."},
				{Order: 4, Title: "Test the flow", Instruction: "Send a POST to {{mock_url}}/items with a JSON body. Then send a GET to {{mock_url}}/items/1. The GET should return the same body you posted."},
				{Order: 5, Title: "Verify recordings", Instruction: "Check the Mock panel's recording tab to see all requests the mock server received.", Expected: "POST returns 201, GET returns the stored object."},
			},
		},
		{
			ID: "git-workflow", Title: "Git-Backed Collaboration Workflow",
			Category: "Collaboration", Description: "Use Git to version-control your collections and collaborate with your team — commit, push, and pull changes.",
			Tags: []string{"git", "collaboration", "team", "version-control"},
			Steps: []Step{
				{Order: 1, Title: "Initialise Git", Instruction: "In the Team panel, initialise a Git repository in your workspace directory. Commit all existing collections."},
				{Order: 2, Title: "Make changes", Instruction: "Edit a request — add a new header or change the URL. The Team panel will show the change as uncommitted."},
				{Order: 3, Title: "Review and commit", Instruction: "Use the Git & PR Preview panel to view the diff. Stage your changes and write a commit message.", Code: "# Or commit via UI:\nCommit message: 'Updated user API endpoint URL'"},
				{Order: 4, Title: "Push to remote", Instruction: "In the Team panel, push your changes to the remote repository. Team members can now pull the latest."},
				{Order: 5, Title: "Handle conflicts", Instruction: "If a team member pushes conflicting changes, use the Git panel's merge tool to resolve them.", Expected: "Team members see the latest collections after pull."},
			},
		},
		{
			ID: "ci-pipeline", Title: "Integrating API Tests into CI/CD Pipeline",
			Category: "CI/CD", Description: "Run your collection as automated API tests in GitHub Actions using the generated CI pipeline.",
			Tags: []string{"ci/cd", "automation", "testing", "github-actions"},
			Steps: []Step{
				{Order: 1, Title: "Prepare the collection", Instruction: "Organise your test requests into a collection. Add assertions to critical endpoints (status code, JSON body checks)."},
				{Order: 2, Title: "Generate CI config", Instruction: "Go to the Integrations panel > CI/CD. Select GitHub Actions. Review the generated YAML.", Code: "# Example snippet:\n- name: Run API tests\n  run: reqit run collection.json --env ci"},
				{Order: 3, Title: "Commit config", Instruction: "Copy the generated .github/workflows/reqit-tests.yml into your repository. Commit and push."},
				{Order: 4, Title: "Check results", Instruction: "Navigate to the Actions tab on GitHub. The workflow will trigger and run your collections as tests."},
				{Order: 5, Title: "Add Slack notifications", Instruction: "Extend the workflow with a Slack notification step to alert the team on test failures.", Expected: "Tests run automatically on every push."},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// 3. Community architecture (Discord / GitHub links + presence)
// ---------------------------------------------------------------------------

type CommunityConfig struct {
	DiscordURL        string `json:"discord_url"`
	GitHubDiscussions string `json:"github_discussions"`
	GitHubIssues      string `json:"github_issues"`
	TwitterURL        string `json:"twitter_url"`
	MaintainersOnline int    `json:"maintainers_online"`
	LastUpdated       string `json:"last_updated"`
}

func DefaultCommunityConfig() CommunityConfig {
	return CommunityConfig{
		DiscordURL:        "https://discord.gg/reqit",
		GitHubDiscussions: "https://github.com/orgs/reqit/discussions",
		GitHubIssues:      "https://github.com/orgs/reqit/issues",
		TwitterURL:        "https://x.com/reqit",
		MaintainersOnline: 3,
		LastUpdated:       time.Now().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// 4. Community-prioritized roadmap (voting)
// ---------------------------------------------------------------------------

type FeatureRequest struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Votes       int      `json:"votes"`
	Status      string   `json:"status"` // "planned" | "in-progress" | "shipped" | "under-review"
	CreatedAt   string   `json:"created_at"`
	Tags        []string `json:"tags"`
}

// DefaultFeatureRequests seeds the built-in roadmap.
func DefaultFeatureRequests() []FeatureRequest {
	return []FeatureRequest{
		{ID: "fr-graphql", Title: "GraphQL client support", Description: "Full GraphQL client with schema introspection, query builder, and variable editor.", Category: "Protocols", Votes: 142, Status: "planned", Tags: []string{"graphql", "protocol"}},
		{ID: "fr-websocket-perf", Title: "WebSocket performance testing", Description: "Load test WebSocket connections with concurrent users and message throughput metrics.", Category: "Testing", Votes: 98, Status: "under-review", Tags: []string{"websocket", "performance"}},
		{ID: "fr-cli-extended", Title: "Extended CLI mode (no GUI)", Description: "Run reqit entirely from the command line for scripting and headless CI environments.", Category: "CLI", Votes: 87, Status: "in-progress", Tags: []string{"cli", "headless"}},
		{ID: "fr-openapi-gen", Title: "OpenAPI code generation (server stubs)", Description: "Generate server stub code from OpenAPI specs in Go, Python, TypeScript, and Java.", Category: "Code Gen", Votes: 76, Status: "under-review", Tags: []string{"openapi", "codegen"}},
		{ID: "fr-grpc-web", Title: "gRPC-Web support", Description: "Test gRPC-Web endpoints from the browser-compatible protocol.", Category: "Protocols", Votes: 65, Status: "planned", Tags: []string{"grpc", "web"}},
		{ID: "fr-bulk-edit", Title: "Bulk edit collections", Description: "Select multiple requests and edit URL, headers, or auth in bulk.", Category: "UX", Votes: 54, Status: "planned", Tags: []string{"ux", "productivity"}},
		{ID: "fr-dark-light", Title: "Additional theme presets", Description: "More built-in themes beyond dark/light (e.g., sepia, high-contrast, dracula).", Category: "UX", Votes: 48, Status: "under-review", Tags: []string{"themes", "ux"}},
		{ID: "fr-export-pdf", Title: "Export collections as PDF docs", Description: "Generate printable PDF documentation from your collections and specs.", Category: "Export", Votes: 41, Status: "planned", Tags: []string{"export", "documentation"}},
		{ID: "fr-sync-selfhost", Title: "Self-hosted sync server", Description: "Run your own sync server for teams that cannot use cloud or Git.", Category: "Collab", Votes: 39, Status: "under-review", Tags: []string{"sync", "self-hosted"}},
		{ID: "fr-ai-assist", Title: "AI-powered request assistant", Description: "Generate request bodies, assertions, and test data using local LLM integration.", Category: "AI", Votes: 33, Status: "under-review", Tags: []string{"ai", "assistance"}},
	}
}

// ---------------------------------------------------------------------------
// 5. Ecosystem growth badges
// ---------------------------------------------------------------------------

type Badge struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SVG         string `json:"svg"`
	Markdown    string `json:"markdown"`
	HTML        string `json:"html"`
}

// GenerateBadges creates the "Built with Reqit" badge set.
func GenerateBadges() []Badge {
	svg := `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="20"><linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="a"><rect width="128" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#a)"><path fill="#555" d="M0 0h55v20H0z"/><path fill="%230891B2" d="M55 0h73v20H55z"/><path fill="url(#b)" d="M0 0h128v20H0z"/></g><g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11"><text x="27.5" y="15" fill="#010101" fill-opacity=".3">reqit</text><text x="27.5" y="14">reqit</text><text x="91" y="15" fill="#010101" fill-opacity=".3">built with</text><text x="91" y="14">built with</text></g></svg>`

	markdown := `[![Built with reqit](https://img.shields.io/badge/reqit-built_with-%230891B2?style=flat-square)](https://reqit.app)`
	html := `<a href="https://reqit.app" target="_blank"><img src="https://img.shields.io/badge/reqit-built_with-%230891B2?style=flat-square" alt="Built with reqit" /></a>`

	return []Badge{
		{ID: "built-with-reqit", Name: "Built with reqit", Description: "Showcase that your project uses reqit for API testing.", SVG: svg, Markdown: markdown, HTML: html},
		{ID: "tested-with-reqit", Name: "Tested with reqit", Description: "Indicate your API tests are powered by reqit.", SVG: svg, Markdown: markdown, HTML: html},
		{ID: "reqit-compatible", Name: "reqit-compatible", Description: "Mark your API as reqit-compatible for easy import.", SVG: svg, Markdown: markdown, HTML: html},
	}
}

// ---------------------------------------------------------------------------
// Store — persistence and access for all growth sub-features
// ---------------------------------------------------------------------------

type Store struct {
	mu       sync.RWMutex
	dataDir  string

	tiers    []FeatureTier
	recipes  []Recipe
	community CommunityConfig
	requests []FeatureRequest
	badges   []Badge
}

func New(dataDir string) *Store {
	s := &Store{
		dataDir:  dataDir,
		tiers:    DefaultFeatureTiers,
		recipes:  DefaultRecipes(),
		community: DefaultCommunityConfig(),
		requests: DefaultFeatureRequests(),
		badges:   GenerateBadges(),
	}
	s.load()
	return s
}

// ---------------------------------------------------------------------------
// Tier accessors
// ---------------------------------------------------------------------------

func (s *Store) GetTiers() []FeatureTier {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]FeatureTier, len(s.tiers))
	copy(out, s.tiers)
	return out
}

func (s *Store) GetTiersByCategory(cat string) []FeatureTier {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []FeatureTier
	for _, t := range s.tiers {
		if t.Category == cat {
			out = append(out, t)
		}
	}
	return out
}

func (s *Store) GetTierCategories() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	seen := map[string]bool{}
	var cats []string
	for _, t := range s.tiers {
		if !seen[t.Category] {
			seen[t.Category] = true
			cats = append(cats, t.Category)
		}
	}
	sort.Strings(cats)
	return cats
}

// ---------------------------------------------------------------------------
// Recipe accessors
// ---------------------------------------------------------------------------

func (s *Store) GetRecipes() []Recipe {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Recipe, len(s.recipes))
	copy(out, s.recipes)
	return out
}

func (s *Store) GetRecipe(id string) (Recipe, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.recipes {
		if r.ID == id {
			return r, true
		}
	}
	return Recipe{}, false
}

func (s *Store) GetRecipeCategories() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	seen := map[string]bool{}
	var cats []string
	for _, r := range s.recipes {
		if !seen[r.Category] {
			seen[r.Category] = true
			cats = append(cats, r.Category)
		}
	}
	sort.Strings(cats)
	return cats
}

// ---------------------------------------------------------------------------
// Community config accessors
// ---------------------------------------------------------------------------

func (s *Store) GetCommunityConfig() CommunityConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.community
}

func (s *Store) SetDiscordURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.community.DiscordURL = url
	s.community.LastUpdated = time.Now().UTC().Format(time.RFC3339)
	s.save()
}

func (s *Store) SetMaintainersOnline(n int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if n < 0 {
		n = 0
	}
	s.community.MaintainersOnline = n
	s.community.LastUpdated = time.Now().UTC().Format(time.RFC3339)
	s.save()
}

// ---------------------------------------------------------------------------
// Roadmap / voting accessors
// ---------------------------------------------------------------------------

func (s *Store) GetFeatureRequests() []FeatureRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]FeatureRequest, len(s.requests))
	copy(out, s.requests)
	return out
}

func (s *Store) GetFeatureRequest(id string) (FeatureRequest, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.requests {
		if r.ID == id {
			return r, true
		}
	}
	return FeatureRequest{}, false
}

func (s *Store) UpvoteFeatureRequest(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.requests {
		if r.ID == id {
			s.requests[i].Votes++
			s.save()
			return nil
		}
	}
	return fmt.Errorf("feature request %q not found", id)
}

func (s *Store) GetFeatureRequestsByVotes() []FeatureRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]FeatureRequest, len(s.requests))
	copy(out, s.requests)
	sort.Slice(out, func(i, j int) bool {
		return out[i].Votes > out[j].Votes
	})
	return out
}

func (s *Store) GetFeatureRequestStatuses() []string {
	return []string{"planned", "in-progress", "shipped", "under-review"}
}

// -- Persistence for votes (so votes survive restart) --

type persistData struct {
	Requests []FeatureRequest `json:"requests"`
}

func (s *Store) load() {
	path := filepath.Join(s.dataDir, "growth", "roadmap.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var pd persistData
	if err := json.Unmarshal(raw, &pd); err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(pd.Requests) > 0 {
		// Merge persisted vote counts into default requests
		merged := make([]FeatureRequest, len(s.requests))
		copy(merged, s.requests)
		for i, def := range merged {
			for _, pr := range pd.Requests {
				if pr.ID == def.ID {
					merged[i].Votes = pr.Votes
					break
				}
			}
		}
		s.requests = merged
	}
}

func (s *Store) save() {
	path := filepath.Join(s.dataDir, "growth")
	if err := os.MkdirAll(path, 0755); err != nil {
		return
	}
	pd := persistData{Requests: s.requests}
	raw, err := json.MarshalIndent(pd, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(path, "roadmap.json"), raw, 0644)
}

// ---------------------------------------------------------------------------
// Badge accessors
// ---------------------------------------------------------------------------

func (s *Store) GetBadges() []Badge {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Badge, len(s.badges))
	copy(out, s.badges)
	return out
}

// MarshalJSON helpers for Wails return values
func MarshalTiers(tiers []FeatureTier) (string, error) {
	b, err := json.Marshal(tiers)
	return string(b), err
}

func MarshalRecipes(recipes []Recipe) (string, error) {
	b, err := json.Marshal(recipes)
	return string(b), err
}

func MarshalRecipe(recipe Recipe) (string, error) {
	b, err := json.Marshal(recipe)
	return string(b), err
}

func MarshalCommunityConfig(cfg CommunityConfig) (string, error) {
	b, err := json.Marshal(cfg)
	return string(b), err
}

func MarshalFeatureRequests(reqs []FeatureRequest) (string, error) {
	b, err := json.Marshal(reqs)
	return string(b), err
}

func MarshalBadges(badges []Badge) (string, error) {
	b, err := json.Marshal(badges)
	return string(b), err
}

// Reserved random source for maintainer count simulation
var rng = rand.New(rand.NewSource(time.Now().UnixNano()))

func init() {
	_ = rng.Intn(100) // ensure seeded
}
