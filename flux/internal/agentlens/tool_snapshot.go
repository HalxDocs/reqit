package agentlens

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"flux/internal/models"
	"flux/internal/storage"
)

const toolSnapshotDir = ".reqit/agent-lens/snapshots"

// ToolSnapshot is a point-in-time capture of a collection's mapped tools.
// It lives beside the OpenAPI snapshots but is per-collection and keyed by
// tool, not by spec path. The frontend diffs two snapshots to flag
// description changes that may affect agent behavior.
type ToolSnapshot struct {
	CollectionID string           `json:"collectionId"`
	CapturedAt   string           `json:"capturedAt"`
	Tools        []ToolDefinition `json:"tools"`
}

// SnapshotPath returns the file path for a collection's tool snapshot.
func SnapshotPath(workspaceDir, collID string) string {
	return filepath.Join(workspaceDir, toolSnapshotDir, "tools-"+collID+".json")
}

// CaptureToolSnapshot maps the collection's requests to tools and persists the
// snapshot. It overwrites the previous snapshot for the same collection — git
// history retains the prior versions, so the drift view can diff any two
// commits via GetDiffContent.
func CaptureToolSnapshot(workspaceDir string, coll models.Collection) (*ToolSnapshot, error) {
	tools := make([]ToolDefinition, 0, len(coll.Requests))
	for _, req := range coll.Requests {
		// Map each SavedRequest to a tool (folder name is not stored on the
		// collection itself, so we pass "")
		saved := models.SavedRequest{
			ID:      req.ID,
			Name:    req.Name,
			Payload: req.Payload,
		}
		tool := MapRequestToTool(saved, "")
		tools = append(tools, tool)
	}
	snap := &ToolSnapshot{
		CollectionID: coll.ID,
		CapturedAt:   time.Now().UTC().Format(time.RFC3339),
		Tools:        tools,
	}
	dir := filepath.Join(workspaceDir, toolSnapshotDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	// Preserve previous snapshot as .prev.json before overwriting — git history
	// also retains it, but the .prev file gives the drift view an instant
	// "before" without needing `git show`.
	prevPath := filepath.Join(toolSnapshotDir, "tools-"+coll.ID+".prev.json")
	currPath := filepath.Join(toolSnapshotDir, "tools-"+coll.ID+".json")
	if _, err := os.Stat(filepath.Join(workspaceDir, currPath)); err == nil {
		// Current exists — copy to prev (best-effort, ignore errors)
		var prevSnap ToolSnapshot
		if err := storage.LoadFrom(workspaceDir, currPath, &prevSnap); err == nil && prevSnap.CollectionID != "" {
			_ = storage.SaveTo(workspaceDir, prevPath, &prevSnap)
		}
	}
	if err := storage.SaveTo(workspaceDir, currPath, snap); err != nil {
		return nil, err
	}
	return snap, nil
}

func LoadToolSnapshot(workspaceDir, collID string) (*ToolSnapshot, error) {
	snap := &ToolSnapshot{}
	path := filepath.Join(toolSnapshotDir, "tools-"+collID+".json")
	if err := storage.LoadFrom(workspaceDir, path, snap); err != nil {
		return nil, err
	}
	if snap.CollectionID == "" {
		return nil, nil
	}
	return snap, nil
}

func LoadPrevToolSnapshot(workspaceDir, collID string) (*ToolSnapshot, error) {
	snap := &ToolSnapshot{}
	path := filepath.Join(toolSnapshotDir, "tools-"+collID+".prev.json")
	if err := storage.LoadFrom(workspaceDir, path, snap); err != nil {
		return nil, err
	}
	if snap.CollectionID == "" {
		return nil, nil
	}
	return snap, nil
}

// ToolDrift describes how a tool's description changed between two snapshots.
type ToolDrift struct {
	ToolName  string `json:"toolName"`
	OldDesc   string `json:"oldDesc"`
	NewDesc   string `json:"newDesc"`
	Changed   bool   `json:"changed"`
	Added     bool   `json:"added"`
	Removed   bool   `json:"removed"`
}

// DiffToolSnapshots compares two snapshots and returns per-tool drift.
// A tool is "added" if it appears only in new, "removed" if only in old,
// "changed" if description differs.
func DiffToolSnapshots(oldSnap, newSnap *ToolSnapshot) []ToolDrift {
	if oldSnap == nil && newSnap == nil {
		return nil
	}
	oldMap := map[string]ToolDefinition{}
	if oldSnap != nil {
		for _, t := range oldSnap.Tools {
			oldMap[t.Name] = t
		}
	}
	newMap := map[string]ToolDefinition{}
	if newSnap != nil {
		for _, t := range newSnap.Tools {
			newMap[t.Name] = t
		}
	}
	seen := map[string]bool{}
	var drifts []ToolDrift
	for name, oldTool := range oldMap {
		seen[name] = true
		newTool, ok := newMap[name]
		if !ok {
			drifts = append(drifts, ToolDrift{ToolName: name, OldDesc: oldTool.Description, Removed: true})
			continue
		}
		if oldTool.Description != newTool.Description {
			drifts = append(drifts, ToolDrift{ToolName: name, OldDesc: oldTool.Description, NewDesc: newTool.Description, Changed: true})
		}
	}
	for name, newTool := range newMap {
		if seen[name] {
			continue
		}
		drifts = append(drifts, ToolDrift{ToolName: name, NewDesc: newTool.Description, Added: true})
	}
	return drifts
}

// ListToolSnapshots returns all tool snapshot file names for a workspace (for debugging).
func ListToolSnapshots(workspaceDir string) ([]string, error) {
	dir := filepath.Join(workspaceDir, toolSnapshotDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []string
	for _, e := range entries {
		if !e.IsDir() {
			out = append(out, e.Name())
		}
	}
	return out, nil
}

// Marshal helper for tests
func marshalToolSnapshot(snap *ToolSnapshot) string {
	b, _ := json.MarshalIndent(snap, "", "  ")
	return string(b)
}
