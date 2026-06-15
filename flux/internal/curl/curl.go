package curl

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"flux/internal/models"
)

// Parser handles high-fidelity cURL command parsing.
type Parser struct {
	// When true, attempts to resolve --data-binary @file references.
	ResolveFileRefs bool
	// Base directory for resolving relative file paths.
	BaseDir string
}

// ParseResult holds the parsed request data.
type ParseResult struct {
	Method      string          `json:"method"`
	URL         string          `json:"url"`
	Headers     []models.Header `json:"headers"`
	Body        string          `json:"body"`
	BodyType    string          `json:"bodyType"`
	Cookies     []models.Header `json:"cookies"`
	Insecure    bool            `json:"insecure"`
	Compressed  bool            `json:"compressed"`
	ResolvedRefs []string       `json:"resolvedRefs,omitempty"`
}

// New creates a cURL parser.
func New() *Parser {
	return &Parser{
		ResolveFileRefs: true,
		BaseDir:         ".",
	}
}

// Parse parses a raw cURL command string and returns the request data.
func (p *Parser) Parse(curlCmd string) (*ParseResult, error) {
	if curlCmd == "" {
		return nil, errors.New("empty cURL command")
	}
	// Normalize line continuations and trim whitespace
	normalized := p.normalize(curlCmd)
	// Tokenize respecting quotes and escapes
	tokens := p.tokenize(normalized)
	if len(tokens) < 2 {
		return nil, errors.New("cURL command too short")
	}
	if !isCurl(tokens[0]) {
		return nil, fmt.Errorf("not a cURL command: %s", tokens[0])
	}
	result := &ParseResult{
		Method:   "GET",
		BodyType: "none",
	}
	// State for multi-value flags
	var dataFromFlag string
	var dataBinary string
	var dataRaw string
	var dataURLEnc []string
	var formData []string
	hasData := false
	hasURL := false

	i := 1
	for i < len(tokens) {
		tok := tokens[i]
		switch {
		case tok == "-X" || tok == "--request" || tok == "-request":
			if i+1 < len(tokens) {
				i++
				result.Method = strings.ToUpper(tokens[i])
			}
		case tok == "-H" || tok == "--header" || tok == "-header":
			if i+1 < len(tokens) {
				i++
				p.parseHeader(tokens[i], result)
			}
		case tok == "-b" || tok == "--cookie" || tok == "-cookie":
			if i+1 < len(tokens) {
				i++
				p.parseCookie(tokens[i], result)
			}
		case tok == "-d" || tok == "--data" || tok == "-data":
			if i+1 < len(tokens) {
				i++
				dataFromFlag = tokens[i]
				hasData = true
			}
		case tok == "--data-binary" || tok == "-data-binary":
			if i+1 < len(tokens) {
				i++
				dataBinary = tokens[i]
				hasData = true
			}
		case tok == "--data-raw" || tok == "-data-raw":
			if i+1 < len(tokens) {
				i++
				dataRaw = tokens[i]
				hasData = true
			}
		case tok == "--data-urlencode" || tok == "-data-urlencode":
			if i+1 < len(tokens) {
				i++
				dataURLEnc = append(dataURLEnc, tokens[i])
				hasData = true
			}
		case tok == "-F" || tok == "--form" || tok == "-form":
			if i+1 < len(tokens) {
				i++
				formData = append(formData, tokens[i])
				hasData = true
				result.BodyType = "form"
			}
		case tok == "-u" || tok == "--user" || tok == "-user":
			if i+1 < len(tokens) {
				i++
				result.Headers = append(result.Headers, models.Header{
					Key: "Authorization", Value: "Basic " + tokens[i], Enabled: true,
				})
			}
		case tok == "-A" || tok == "--user-agent" || tok == "-user-agent":
			if i+1 < len(tokens) {
				i++
				result.Headers = append(result.Headers, models.Header{
					Key: "User-Agent", Value: tokens[i], Enabled: true,
				})
			}
		case tok == "-k" || tok == "--insecure" || tok == "-insecure":
			result.Insecure = true
		case tok == "--compressed" || tok == "-compressed":
			result.Compressed = true
		case tok == "-L" || tok == "--location" || tok == "-location":
			// Follow redirects — no-op for import
		case tok == "-o" || tok == "--output" || tok == "-output":
			// Output file — skip value
			if i+1 < len(tokens) {
				i++
			}
		case tok == "-s" || tok == "--silent" || tok == "-silent":
			// Silent mode — no-op
		case tok == "-v" || tok == "--verbose" || tok == "-verbose":
			// Verbose — no-op
		case strings.HasPrefix(tok, "-"):
			// Unknown flag — skip
		default:
			// Positional argument — URL
			if !hasURL && !strings.HasPrefix(tok, "-") {
				result.URL = tok
				hasURL = true
			}
		}
		i++
	}

	// Process data
	if hasData {
		p.processData(result, dataFromFlag, dataBinary, dataRaw, dataURLEnc, formData)
	}

	// Determine method
	p.determineMethod(result, hasData)

	return result, nil
}

func (p *Parser) normalize(cmd string) string {
	// Replace backslash-newline with space
	re := regexp.MustCompile(`\\\s*\n\s*`)
	cmd = re.ReplaceAllString(cmd, " ")
	// Collapse multiple spaces
	re = regexp.MustCompile(`\s+`)
	cmd = re.ReplaceAllString(cmd, " ")
	return strings.TrimSpace(cmd)
}

func (p *Parser) tokenize(cmd string) []string {
	var tokens []string
	var current strings.Builder
	inSingle := false
	inDouble := false
	escape := false

	for _, ch := range cmd {
		if escape {
			current.WriteRune(ch)
			escape = false
			continue
		}
		if ch == '\\' {
			escape = true
			continue
		}
		if ch == '\'' && !inDouble {
			inSingle = !inSingle
			continue
		}
		if ch == '"' && !inSingle {
			inDouble = !inDouble
			continue
		}
		if (ch == ' ' || ch == '\t') && !inSingle && !inDouble {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			continue
		}
		current.WriteRune(ch)
	}
	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}
	return tokens
}

func isCurl(tok string) bool {
	lower := strings.ToLower(strings.TrimSpace(tok))
	return lower == "curl" || lower == "curl.exe" || strings.HasSuffix(lower, "/curl") || strings.HasSuffix(lower, "\\curl")
}

func (p *Parser) parseHeader(raw string, result *ParseResult) {
	idx := strings.Index(raw, ":")
	if idx < 0 {
		result.Headers = append(result.Headers, models.Header{Key: raw, Value: "", Enabled: true})
		return
	}
	key := strings.TrimSpace(raw[:idx])
	value := strings.TrimSpace(raw[idx+1:])
	// If it's a Cookie header, parse cookies separately
	if strings.EqualFold(key, "Cookie") {
		p.parseCookie(value, result)
		return
	}
	result.Headers = append(result.Headers, models.Header{Key: key, Value: value, Enabled: true})
}

func (p *Parser) parseCookie(raw string, result *ParseResult) {
	for _, part := range strings.Split(raw, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		idx := strings.Index(part, "=")
		if idx < 0 {
			result.Cookies = append(result.Cookies, models.Header{Key: part, Value: "", Enabled: true})
		} else {
			result.Cookies = append(result.Cookies, models.Header{
				Key: strings.TrimSpace(part[:idx]),
				Value: strings.TrimSpace(part[idx+1:]),
				Enabled: true,
			})
		}
	}
}

func (p *Parser) processData(result *ParseResult, data, dataBinary, dataRaw string, dataURLEnc, formData []string) {
	// Prefer data-binary over data-raw over data
	payload := data
	source := "data"
	if dataBinary != "" {
		payload = dataBinary
		source = "data-binary"
	} else if dataRaw != "" {
		payload = dataRaw
		source = "data-raw"
	}
	// Handle @file references
	if strings.HasPrefix(payload, "@") {
		filePath := payload[1:]
		if p.ResolveFileRefs && p.BaseDir != "" {
			if !filepath.IsAbs(filePath) {
				filePath = filepath.Join(p.BaseDir, filePath)
			}
			if data, err := os.ReadFile(filePath); err == nil {
				payload = string(data)
				result.ResolvedRefs = append(result.ResolvedRefs, filePath)
			}
		}
	}
	// Guess body type
	result.Body = payload
	if source == "data-binary" || strings.HasPrefix(payload, "{") || strings.HasPrefix(payload, "[") {
		result.BodyType = "json"
	} else if strings.HasPrefix(payload, "<?xml") || strings.HasPrefix(payload, "<") {
		result.BodyType = "xml"
	} else {
		result.BodyType = "raw"
	}
	// Add Content-Type if not already set
	hasCT := false
	for _, h := range result.Headers {
		if strings.EqualFold(h.Key, "Content-Type") {
			hasCT = true
			break
		}
	}
	if !hasCT {
		ct := "application/x-www-form-urlencoded"
		if result.BodyType == "json" {
			ct = "application/json"
		} else if result.BodyType == "xml" {
			ct = "application/xml"
		}
		result.Headers = append(result.Headers, models.Header{Key: "Content-Type", Value: ct, Enabled: true})
	}
}

func (p *Parser) determineMethod(result *ParseResult, hasData bool) {
	if result.Method != "GET" {
		return
	}
	if hasData {
		result.Method = "POST"
	}
	// Check for explicit -X POST or override via method override header
	for _, h := range result.Headers {
		if strings.EqualFold(h.Key, "X-HTTP-Method-Override") {
			result.Method = strings.ToUpper(h.Value)
			return
		}
	}
}

// ToRequestPayload converts a ParseResult to a models.RequestPayload.
func ToRequestPayload(pr *ParseResult) models.RequestPayload {
	payload := models.RequestPayload{
		Method:   pr.Method,
		URL:      pr.URL,
		Headers:  pr.Headers,
		Body:     pr.Body,
		BodyType: pr.BodyType,
		AuthType: "none",
	}
	// Add cookies as pseudo-headers if they're not already present
	for _, c := range pr.Cookies {
		hasCookie := false
		for _, h := range pr.Headers {
			if strings.EqualFold(h.Key, "Cookie") && strings.Contains(h.Value, c.Key+"=") {
				hasCookie = true
				break
			}
		}
		if !hasCookie {
			payload.Headers = append(payload.Headers, c)
		}
	}
	// Detect auth from Authorization header
	for _, h := range pr.Headers {
		lowerKey := strings.ToLower(h.Key)
		if lowerKey == "authorization" {
			lowerVal := strings.ToLower(h.Value)
			if strings.HasPrefix(lowerVal, "bearer ") {
				payload.AuthType = "bearer"
				payload.AuthValue = strings.TrimSpace(h.Value[7:])
			} else if strings.HasPrefix(lowerVal, "basic ") {
				payload.AuthType = "basic"
				payload.AuthValue = strings.TrimSpace(h.Value[6:])
			}
		}
	}
	return payload
}

// ParseCurlString is a convenience function for single-use parsing.
func ParseCurlString(curlCmd string) (*ParseResult, error) {
	return New().Parse(curlCmd)
}

// ValidateCurl checks if a string is a valid cURL command.
func ValidateCurl(curlCmd string) bool {
	_, err := ParseCurlString(curlCmd)
	return err == nil
}

// GenerateCurl generates a cURL command string from a request payload.
func GenerateCurl(payload models.RequestPayload) string {
	var sb strings.Builder
	sb.WriteString("curl")
	if payload.Method != "GET" && payload.Method != "POST" {
		sb.WriteString(fmt.Sprintf(" -X %s", payload.Method))
	}
	for _, h := range payload.Headers {
		if !h.Enabled {
			continue
		}
		sb.WriteString(fmt.Sprintf(" -H '%s: %s'", h.Key, h.Value))
	}
	if payload.Body != "" && payload.BodyType != "none" {
		sb.WriteString(fmt.Sprintf(" --data-binary '%s'", jsonEscape(payload.Body)))
	} else if payload.Method == "POST" && len(payload.BodyForm) > 0 {
		var parts []string
		for _, f := range payload.BodyForm {
			parts = append(parts, f.Key+"="+f.Value)
		}
		sb.WriteString(" -d '" + strings.Join(parts, "&") + "'")
	}
	sb.WriteString(fmt.Sprintf(" '%s'", payload.URL))
	return sb.String()
}

func jsonEscape(s string) string {
	// Escape single quotes for shell safety
	s = strings.ReplaceAll(s, "'", "'\\''")
	return s
}
