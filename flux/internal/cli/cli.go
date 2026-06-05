package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"flux/internal/collections"
	"flux/internal/environments"
	"flux/internal/models"
	"flux/internal/requester"
	"flux/internal/workspaces"
)

var varPattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

// Run is the CLI entry point. It returns an exit code (0 = success).
func Run(args []string) int {
	if len(args) < 1 {
		printUsage()
		return 0
	}

	switch args[0] {
	case "run":
		return runCollection(args[1:])
	case "list":
		return listResources(args[1:])
	case "help", "--help", "-h":
		printUsage()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", args[0])
		printUsage()
		return 1
	}
}

func printUsage() {
	fmt.Fprintf(os.Stderr, `reqit — API client

Usage:
  reqit run <collection> [--env <name>] [--output <format>]
  reqit list collections
  reqit list environments
  reqit help

Flags:
  --env       Environment name (default: active environment)
  --output    Output format: text (default) or json
  --workspace Workspace ID (default: active workspace)
`)
}

// ---- list ----

func listResources(args []string) int {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: reqit list collections|environments")
		return 1
	}

	wsDir, err := getWorkspaceDir("")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	switch args[0] {
	case "collections":
		cs := collections.NewStore(wsDir)
		all, err := cs.GetAll()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading collections: %v\n", err)
			return 1
		}
		if len(all) == 0 {
			fmt.Println("No collections found.")
			return 0
		}
		for _, c := range all {
			fmt.Printf("  %s  (%d requests)\n", c.Name, len(c.Requests))
		}

	case "environments", "envs":
		es := environments.NewStore(wsDir)
		snap, err := es.Get()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading environments: %v\n", err)
			return 1
		}
		if len(snap.Environments) == 0 {
			fmt.Println("No environments found.")
			return 0
		}
		for _, e := range snap.Environments {
			mark := ""
			if e.ID == snap.Active {
				mark = " (active)"
			}
			fmt.Printf("  %s%s  (%d vars)\n", e.Name, mark, len(e.Vars))
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown resource: %s\n", args[0])
		return 1
	}
	return 0
}

// ---- run ----

type runFlags struct {
	envName   string
	outputFmt string
	wsID      string
}

func runCollection(args []string) int {
	var f runFlags
	var collParts []string
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--env" || args[i] == "-e":
			if i+1 < len(args) {
				i++
				f.envName = args[i]
			}
		case args[i] == "--output" || args[i] == "-o":
			if i+1 < len(args) {
				i++
				f.outputFmt = args[i]
			}
		case args[i] == "--workspace" || args[i] == "-w":
			if i+1 < len(args) {
				i++
				f.wsID = args[i]
			}
		case args[i] == "--help" || args[i] == "-h":
			fmt.Fprintln(os.Stderr, "Usage: reqit run <collection> [--env <name>] [--output text|json] [--workspace <id>]")
			return 0
		default:
			collParts = append(collParts, args[i])
		}
	}

	collName := strings.Join(collParts, " ")
	if collName == "" {
		fmt.Fprintln(os.Stderr, "Error: collection name is required")
		fmt.Fprintln(os.Stderr, "Usage: reqit run <collection> [--env <name>] [--output text|json]")
		return 1
	}

	wsDir, err := getWorkspaceDir(f.wsID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	// Load collections and find the one by name.
	cs := collections.NewStore(wsDir)
	allColls, err := cs.GetAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading collections: %v\n", err)
		return 1
	}

	var coll *models.Collection
	for i := range allColls {
		if allColls[i].Name == collName {
			coll = &allColls[i]
			break
		}
	}
	if coll == nil {
		fmt.Fprintf(os.Stderr, "Collection not found: %s\n", collName)
		return 1
	}

	if len(coll.Requests) == 0 {
		fmt.Printf("Collection %q has no requests.\n", collName)
		return 0
	}

	// Load environments and pick the right one.
	es := environments.NewStore(wsDir)
	envSnap, err := es.Get()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading environments: %v\n", err)
		return 1
	}

	var env *models.Environment
	if f.envName != "" {
		for i := range envSnap.Environments {
			if envSnap.Environments[i].Name == f.envName {
				env = &envSnap.Environments[i]
				break
			}
		}
		if env == nil {
			fmt.Fprintf(os.Stderr, "Environment not found: %s\n", f.envName)
			return 1
		}
	} else if envSnap.Active != "" {
		for i := range envSnap.Environments {
			if envSnap.Environments[i].ID == envSnap.Active {
				env = &envSnap.Environments[i]
				break
			}
		}
	}

	envMap := buildEnvMap(env)

	// Run requests sequentially so output order is deterministic.
	start := time.Now()
	results := make([]requestResult, 0, len(coll.Requests))
	var passed, failed int

	for _, req := range coll.Requests {
		payload := resolvePayload(req.Payload, envMap)

		res := requester.Execute(context.Background(), payload, nil)

		r := requestResult{
			Name:       req.Name,
			URL:        payload.URL,
			Method:     payload.Method,
			StatusCode: res.StatusCode,
			StatusText: res.Status,
			TimingMs:   res.TimingMs,
			SizeBytes:  res.SizeBytes,
			Error:      res.Error,
		}
		if res.Error != "" {
			r.Failed = true
			failed++
		} else {
			passed++
		}
		results = append(results, r)

		if f.outputFmt == "text" {
			printTextResult(r)
		}
	}

	duration := time.Since(start)

	switch f.outputFmt {
	case "json":
		printJSONSummary(coll.Name, results, passed, failed, duration)
	case "text":
		printTextSummary(coll.Name, passed, failed, len(coll.Requests), duration)
	}

	if failed > 0 {
		return 1
	}
	return 0
}

// ---- variable resolution ----

func buildEnvMap(env *models.Environment) map[string]string {
	m := make(map[string]string)
	if env == nil {
		return m
	}
	for _, v := range env.Vars {
		if v.Enabled && v.Key != "" {
			m[v.Key] = v.Value
		}
	}
	return m
}

func resolve(s string, env map[string]string) string {
	return varPattern.ReplaceAllStringFunc(s, func(match string) string {
		name := strings.TrimSpace(match[2 : len(match)-2])
		if v, ok := env[name]; ok {
			return v
		}
		return match
	})
}

func resolvePayload(p models.RequestPayload, env map[string]string) models.RequestPayload {
	p.URL = resolve(p.URL, env)
	for i := range p.Headers {
		if p.Headers[i].Enabled {
			p.Headers[i].Value = resolve(p.Headers[i].Value, env)
		}
	}
	for i := range p.Params {
		if p.Params[i].Enabled {
			p.Params[i].Value = resolve(p.Params[i].Value, env)
		}
	}
	p.Body = resolve(p.Body, env)
	p.AuthValue = resolve(p.AuthValue, env)
	for i := range p.BodyForm {
		if p.BodyForm[i].Enabled {
			p.BodyForm[i].Value = resolve(p.BodyForm[i].Value, env)
		}
	}
	return p
}

// ---- output ----

type requestResult struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	Method     string `json:"method"`
	StatusCode int    `json:"statusCode"`
	StatusText string `json:"statusText"`
	TimingMs   int64  `json:"timingMs"`
	SizeBytes  int64  `json:"sizeBytes"`
	Failed     bool   `json:"failed"`
	Error      string `json:"error,omitempty"`
}

func printTextResult(r requestResult) {
	status := r.StatusCode
	if r.Failed {
		fmt.Printf("  ✕ %s  [%s %s]  ERROR: %s\n", r.Name, r.Method, r.URL, r.Error)
	} else {
		fmt.Printf("  ✓ %s  [%s %s]  %d  %s  %s\n", r.Name, r.Method, r.URL, status, formatTiming(r.TimingMs), formatSize(r.SizeBytes))
	}
}

func printTextSummary(name string, passed, failed, total int, dur time.Duration) {
	fmt.Println()
	fmt.Printf("Collection: %s\n", name)
	fmt.Printf("  %d / %d passed", passed, total)
	if failed > 0 {
		fmt.Printf(", %d failed", failed)
	}
	fmt.Println()
	fmt.Printf("  Duration: %s\n", formatTiming(dur.Milliseconds()))
}

func printJSONSummary(name string, results []requestResult, passed, failed int, dur time.Duration) {
	out := map[string]any{
		"collection": name,
		"results":    results,
		"passed":     passed,
		"failed":     failed,
		"total":      len(results),
		"durationMs": dur.Milliseconds(),
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(out)
}

// ---- helpers ----

func getWorkspaceDir(wsID string) (string, error) {
	ws := workspaces.NewStore()
	if wsID == "" {
		dir, err := ws.ActiveDir()
		if err != nil {
			return "", fmt.Errorf("no active workspace: %w", err)
		}
		if dir == "" {
			return "", fmt.Errorf("no active workspace. Create one in the reqit GUI first, or use --workspace")
		}
		return dir, nil
	}
	all, err := ws.GetAll()
	if err != nil {
		return "", fmt.Errorf("cannot list workspaces: %w", err)
	}
	for _, w := range all {
		if w.ID == wsID {
			return w.DataDir, nil
		}
	}
	return "", fmt.Errorf("workspace not found: %s", wsID)
}

func formatTiming(ms int64) string {
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	return fmt.Sprintf("%.1fs", float64(ms)/1000)
}

func formatSize(bytes int64) string {
	if bytes < 1024 {
		return fmt.Sprintf("%dB", bytes)
	}
	if bytes < 1024*1024 {
		return fmt.Sprintf("%.1fKB", float64(bytes)/1024)
	}
	return fmt.Sprintf("%.1fMB", float64(bytes)/(1024*1024))
}
