package trust

import (
	"context"
	"log"
	"net/http"
	"sort"
	"strings"

	"flux/internal/models"
	"flux/internal/requester"
)

// Source names the surface that issued an execution. It appears in every
// receipt so a human can tell an app click from an agent tool call.
const (
	SourceApp       = "app"
	SourceCLI       = "cli"
	SourceMCP       = "mcp"
	SourceRunner    = "runner"
	SourceScheduler = "scheduler"
	SourceLoadTest  = "loadtest"
	SourceReplay    = "replay"
)

// Options describes where a run came from and how to record it.
type Options struct {
	// Store overrides the process-wide store. Nil means DefaultStore().
	Store *Store
	// Source is one of the Source* constants.
	Source string
	// Session groups related runs, for example one MCP conversation.
	Session string
	// Environment is the active environment name at send time.
	Environment string
	// Workspace is recorded for diagnostics; it is not part of the decision.
	Workspace string
	// StoreBodyPreviews includes a capped body preview in the receipt. Off by
	// default: a body can contain a credential the redactor cannot identify.
	StoreBodyPreviews bool
	// Skip executes without recording. Load tests use it because they can
	// issue thousands of requests a minute and would bury the real history.
	Skip bool
}

func storeFor(opts Options) *Store {
	if opts.Store != nil {
		return opts.Store
	}
	return DefaultStore()
}

// Execute runs a request through the requester and records a receipt when a
// store is available. It returns the response and the receipt id (empty when
// nothing was recorded). A recording failure never fails the request.
func Execute(ctx context.Context, payload models.RequestPayload, jar http.CookieJar, opts Options) (models.ResponseResult, string) {
	res := requester.Execute(ctx, payload, jar)
	return res, record(payload, res, opts)
}

// ExecuteStream is Execute for responses that emit Server-Sent Events.
func ExecuteStream(ctx context.Context, payload models.RequestPayload, jar http.CookieJar, onEvent func(models.SSEEvent), opts Options) (models.ResponseResult, string) {
	res := requester.ExecuteStream(ctx, payload, jar, onEvent)
	return res, record(payload, res, opts)
}

// Annotate attaches information that only exists after execution, such as
// contract validation. It is a no-op when there is no store or no receipt.
func Annotate(store *Store, id string, fn func(*Receipt)) {
	if store == nil || id == "" || fn == nil {
		return
	}
	_ = store.Annotate(id, fn)
}

// AnnotateDefault is Annotate against the process-wide store.
func AnnotateDefault(id string, fn func(*Receipt)) {
	Annotate(DefaultStore(), id, fn)
}

func record(payload models.RequestPayload, res models.ResponseResult, opts Options) string {
	if opts.Skip {
		return ""
	}
	store := storeFor(opts)
	if store == nil {
		return ""
	}

	r := buildReceipt(payload, res, opts)
	if err := store.Write(r); err != nil {
		// A receipt failure must not fail the request, but it should not be
		// silent either: a store that is full, read-only or locked would
		// otherwise look like "no runs happened".
		log.Printf("reqit: could not record run receipt: %v", err)
		return ""
	}
	return r.ID
}

// buildReceipt turns one payload and result into a record that is safe to
// write to disk.
func buildReceipt(payload models.RequestPayload, res models.ResponseResult, opts Options) *Receipt {
	req, resolution := buildRequest(payload, opts)

	r := &Receipt{
		Version:     ReceiptVersion,
		Kind:        "run",
		Source:      opts.Source,
		Session:     opts.Session,
		Environment: opts.Environment,
		Workspace:   opts.Workspace,
		Request:     req,
		Resolution:  resolution,
		Timing:      res.Timing,
		Validation:  res.Validation,
		Response: ResponseRecord{
			Status:       res.Status,
			StatusCode:   res.StatusCode,
			Headers:      redactResponseHeaders(res.Headers),
			BodySHA256:   sha256Hex(res.Body),
			BodyBytes:    res.SizeBytes,
			BodyIsBase64: res.BodyIsBase64,
			Cookies:      len(res.Cookies),
			Error:        res.Error,
		},
	}
	if opts.StoreBodyPreviews {
		r.Request.BodyPreview = preview(reqBody(payload), previewLimit)
		r.Response.BodyPreview = preview(res.Body, previewLimit)
	}
	return r
}

// buildRequest records the request as written, not as expanded. When Origin is
// missing it falls back to the executed payload with credentials masked.
func buildRequest(p models.RequestPayload, opts Options) (RequestRecord, []Resolution) {
	var (
		rawURL   = p.URL
		headers  = p.Headers
		params   = p.Params
		body     = p.Body
		bodyType = p.BodyType
		sources  = map[string]string{}
	)

	if o := p.Origin; o != nil {
		if o.URL != "" {
			rawURL = o.URL
		}
		if len(o.Headers) > 0 {
			headers = o.Headers
		}
		if len(o.Params) > 0 {
			params = o.Params
		}
		if o.Body != "" {
			body = o.Body
		}
		for name, source := range o.VarSources {
			sources[name] = source
		}
	}

	// Any placeholder still present was never resolved. Recording it is
	// useful: it explains a 401 far faster than a bare status code.
	for _, name := range placeholders(rawURL + " " + body + headerText(headers) + headerText(params)) {
		if _, ok := sources[name]; !ok {
			sources[name] = "unresolved"
		}
	}

	rec := RequestRecord{
		Method:     strings.ToUpper(strings.TrimSpace(p.Method)),
		URL:        redactURL(rawURL),
		Headers:    redactHeaders(headers),
		Params:     redactHeaders(params),
		BodyType:   bodyType,
		BodySHA256: sha256Hex(body),
		BodyBytes:  len(body),
		AuthType:   p.AuthType,
	}

	names := make([]string, 0, len(sources))
	for name := range sources {
		names = append(names, name)
	}
	sort.Strings(names)
	resolution := make([]Resolution, 0, len(names))
	for _, name := range names {
		resolution = append(resolution, Resolution{Name: name, Source: sources[name]})
	}
	return rec, resolution
}

func reqBody(p models.RequestPayload) string {
	if o := p.Origin; o != nil && o.Body != "" {
		return o.Body
	}
	return p.Body
}

func headerText(headers []models.Header) string {
	var b strings.Builder
	for _, h := range headers {
		b.WriteString(h.Value)
		b.WriteByte(' ')
	}
	return b.String()
}

// OriginFrom builds a RequestOrigin from a payload. When the payload already
// carries an origin (the app saves one with every request), that templated
// request is preserved rather than replaced by the possibly-resolved URL.
// Placeholders without a recorded source are attributed to source.
func OriginFrom(templated models.RequestPayload, source string) *models.RequestOrigin {
	var o *models.RequestOrigin
	if templated.Origin != nil {
		clone := *templated.Origin
		if clone.VarSources != nil {
			// Copy the map: OriginFrom adds any unresolved placeholders, and
			// it must not mutate the caller's payload.
			sources := make(map[string]string, len(clone.VarSources))
			for name, source := range clone.VarSources {
				sources[name] = source
			}
			clone.VarSources = sources
		}
		o = &clone
	} else {
		o = &models.RequestOrigin{
			URL:      templated.URL,
			Headers:  templated.Headers,
			Params:   templated.Params,
			Body:     templated.Body,
			BodyForm: templated.BodyForm,
		}
	}
	if o.URL == "" {
		o.URL = templated.URL
	}
	if o.URL == "" && o.Body == "" && len(o.Headers) == 0 && len(o.Params) == 0 && len(o.BodyForm) == 0 {
		return o
	}

	names := placeholders(o.URL + " " + o.Body + headerText(o.Headers) + headerText(o.Params) + headerText(o.BodyForm))
	if len(names) > 0 {
		if o.VarSources == nil {
			o.VarSources = make(map[string]string, len(names))
		}
		for _, name := range names {
			if _, ok := o.VarSources[name]; !ok {
				o.VarSources[name] = source
			}
		}
	}
	return o
}
