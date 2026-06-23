package schema

import (
	"encoding/json"
	"fmt"
	"sort"
)

// Drift represents the difference between two schema snapshots.
type Drift struct {
	OldVersion string            `json:"oldVersion"`
	NewVersion string            `json:"newVersion"`
	Added      []EndpointDrift   `json:"added"`
	Removed    []EndpointDrift   `json:"removed"`
	Changed    []EndpointDrift   `json:"changed"`
	Summary    string            `json:"summary"`
}

// EndpointDrift describes a change to a single endpoint.
type EndpointDrift struct {
	Method string        `json:"method"`
	Path   string        `json:"path"`
	Detail string        `json:"detail,omitempty"`
	Changes []FieldChange `json:"changes,omitempty"`
}

// FieldChange is a single field-level change within an endpoint.
type FieldChange struct {
	Field    string `json:"field"`
	OldValue string `json:"oldValue,omitempty"`
	NewValue string `json:"newValue,omitempty"`
	Kind     string `json:"kind"` // "added", "removed", "changed"
}

// DetectDrift compares old and new snapshots and returns the structured diff.
func DetectDrift(old, new *Snapshot) *Drift {
	d := &Drift{
		OldVersion: old.Version,
		NewVersion: new.Version,
	}

	oldMap := make(map[string]Endpoint)
	for _, ep := range old.Endpoints {
		key := endpointKey(ep.Method, ep.Path)
		oldMap[key] = ep
	}

	newMap := make(map[string]Endpoint)
	for _, ep := range new.Endpoints {
		key := endpointKey(ep.Method, ep.Path)
		newMap[key] = ep
	}

	// Find added and changed endpoints
	for key, newEp := range newMap {
		oldEp, exists := oldMap[key]
		if !exists {
			d.Added = append(d.Added, EndpointDrift{
				Method: newEp.Method,
				Path:   newEp.Path,
				Detail: "endpoint added",
			})
			continue
		}

		changes := diffEndpoint(oldEp, newEp)
		if len(changes) > 0 {
			d.Changed = append(d.Changed, EndpointDrift{
				Method:  newEp.Method,
				Path:    newEp.Path,
				Changes: changes,
			})
		}
	}

	// Find removed endpoints
	for key, oldEp := range oldMap {
		if _, exists := newMap[key]; !exists {
			d.Removed = append(d.Removed, EndpointDrift{
				Method: oldEp.Method,
				Path:   oldEp.Path,
				Detail: "endpoint removed",
			})
		}
	}

	// Sort for deterministic output
	sort.Slice(d.Added, func(i, j int) bool {
		return endpointKey(d.Added[i].Method, d.Added[i].Path) < endpointKey(d.Added[j].Method, d.Added[j].Path)
	})
	sort.Slice(d.Removed, func(i, j int) bool {
		return endpointKey(d.Removed[i].Method, d.Removed[i].Path) < endpointKey(d.Removed[j].Method, d.Removed[j].Path)
	})
	sort.Slice(d.Changed, func(i, j int) bool {
		return endpointKey(d.Changed[i].Method, d.Changed[i].Path) < endpointKey(d.Changed[j].Method, d.Changed[j].Path)
	})

	// Build summary
	total := len(d.Added) + len(d.Removed) + len(d.Changed)
	if total == 0 {
		d.Summary = "No schema drift detected."
	} else {
		d.Summary = fmt.Sprintf(
			"%d change(s): %d added, %d removed, %d modified",
			total, len(d.Added), len(d.Removed), len(d.Changed),
		)
	}

	return d
}

// diffEndpoint compares two versions of the same endpoint and returns field-level changes.
func diffEndpoint(old, new Endpoint) []FieldChange {
	var changes []FieldChange

	// Compare parameters
	oldParams := make(map[string]Param)
	for _, p := range old.Parameters {
		oldParams[p.Name+":"+p.In] = p
	}
	newParams := make(map[string]Param)
	for _, p := range new.Parameters {
		newParams[p.Name+":"+p.In] = p
	}

	for key, np := range newParams {
		op, exists := oldParams[key]
		if !exists {
			changes = append(changes, FieldChange{
				Field:    fmt.Sprintf("parameter %s (%s)", np.Name, np.In),
				NewValue: formatParam(np),
				Kind:     "added",
			})
			continue
		}
		if paramDiff := diffParam(op, np); len(paramDiff) > 0 {
			changes = append(changes, paramDiff...)
		}
	}
	for key, op := range oldParams {
		if _, exists := newParams[key]; !exists {
			changes = append(changes, FieldChange{
				Field:    fmt.Sprintf("parameter %s (%s)", op.Name, op.In),
				OldValue: formatParam(op),
				Kind:     "removed",
			})
		}
	}

	// Compare request body
	oldBody := formatSchema(old.RequestBody)
	newBody := formatSchema(new.RequestBody)
	if oldBody != newBody {
		kind := "changed"
		if oldBody == "" {
			kind = "added"
		} else if newBody == "" {
			kind = "removed"
		}
		changes = append(changes, FieldChange{
			Field:    "requestBody",
			OldValue: oldBody,
			NewValue: newBody,
			Kind:     kind,
		})
	}

	// Compare responses
	oldResp := make(map[string]Response)
	for _, r := range old.Responses {
		oldResp[r.StatusCode] = r
	}
	newResp := make(map[string]Response)
	for _, r := range new.Responses {
		newResp[r.StatusCode] = r
	}
	for code, nr := range newResp {
		or, exists := oldResp[code]
		if !exists {
			changes = append(changes, FieldChange{
				Field:    fmt.Sprintf("response %s", code),
				NewValue: formatSchema(nr.Schema),
				Kind:     "added",
			})
			continue
		}
		oldS := formatSchema(or.Schema)
		newS := formatSchema(nr.Schema)
		if oldS != newS {
			changes = append(changes, FieldChange{
				Field:    fmt.Sprintf("response %s", code),
				OldValue: oldS,
				NewValue: newS,
				Kind:     "changed",
			})
		}
	}
	for code, or := range oldResp {
		if _, exists := newResp[code]; !exists {
			changes = append(changes, FieldChange{
				Field:    fmt.Sprintf("response %s", code),
				OldValue: formatSchema(or.Schema),
				Kind:     "removed",
			})
		}
	}

	// Compare tags
	if fmt.Sprint(old.Tags) != fmt.Sprint(new.Tags) {
		changes = append(changes, FieldChange{
			Field:    "tags",
			OldValue: fmt.Sprint(old.Tags),
			NewValue: fmt.Sprint(new.Tags),
			Kind:     "changed",
		})
	}

	return changes
}

func diffParam(old, new Param) []FieldChange {
	var changes []FieldChange
	if old.Required != new.Required {
		changes = append(changes, FieldChange{
			Field:    fmt.Sprintf("parameter %s.required", old.Name),
			OldValue: fmt.Sprintf("%v", old.Required),
			NewValue: fmt.Sprintf("%v", new.Required),
			Kind:     "changed",
		})
	}
	oldS := formatSchema(old.Schema)
	newS := formatSchema(new.Schema)
	if oldS != newS {
		changes = append(changes, FieldChange{
			Field:    fmt.Sprintf("parameter %s.schema", old.Name),
			OldValue: oldS,
			NewValue: newS,
			Kind:     "changed",
		})
	}
	return changes
}

func endpointKey(method, path string) string {
	return method + " " + path
}

func formatParam(p Param) string {
	s := fmt.Sprintf("in=%s, required=%v", p.In, p.Required)
	if p.Schema != nil {
		s += ", type=" + p.Schema.Type
	}
	return s
}

func formatSchema(s *SchemaRef) string {
	if s == nil {
		return ""
	}
	data, _ := json.Marshal(s)
	return string(data)
}

// HasChanges returns true if the drift contains any changes.
func (d *Drift) HasChanges() bool {
	return len(d.Added) > 0 || len(d.Removed) > 0 || len(d.Changed) > 0
}

// BreakingChanges returns only the breaking changes (removals and modifications).
func (d *Drift) BreakingChanges() []EndpointDrift {
	var breaking []EndpointDrift
	breaking = append(breaking, d.Removed...)
	for _, c := range d.Changed {
		for _, ch := range c.Changes {
			if ch.Kind == "removed" || (ch.Kind == "changed" && ch.Field == "requestBody") {
				breaking = append(breaking, c)
				break
			}
		}
	}
	return breaking
}
