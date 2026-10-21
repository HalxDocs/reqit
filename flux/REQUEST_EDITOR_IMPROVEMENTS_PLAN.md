# Request Editor Improvements — Implementation Plan

Six user-facing requests. Every finding below was read out of the current code
(commit `5d99a4f`), not inferred from the feature list.

## Summary of root causes

| # | Request | Actual root cause | Confidence |
|---|---------|-------------------|-----------|
| 1 | Large JSON payload scrolling | CodeMirror height is not bounded in the flex chain; editor grows to content height | Hypothesis — needs measurement (see §1) |
| 2 | Ctrl+A selects all | Nothing is bound to Ctrl+A today; the risk is the global handler swallowing it once it *is* bound | Confirmed — no `ctrl+a` binding exists |
| 3 | Detect cURL in URL field | No detection implemented; `parseCurl` exists but is only reachable via a modal | Confirmed |
| 4 | Ctrl+S saves + notifies | **Ctrl+S is bound twice**; the later binding shadows the global one, then scope-filtering discards it → the key does nothing | Confirmed — see §4 |
| 5 | Ctrl+Z in URL field | Global `edit.undo` calls `preventDefault()` in the URL bar, killing native undo; its own stack is never populated | Confirmed — see §5 |
| 6 | Don't unescape nested JSON in cURL | `tokenize()` treats `\` as an escape inside single quotes; POSIX says single quotes are literal | Confirmed — see §6 |

Two of these (§4, §5) share one root cause: the global keyboard handler does not
distinguish "the user is typing" from "the user is invoking a command".

---

## 0. Foundation — fix the keybinding engine first

`shared/lib/commands.ts` is the single dispatcher for every shortcut. Both §4
and §5 are defects in it, and §2 is a latent defect in it. Fixing it first
means the other three features land on a correct base.

### 0.1 Two commands are bound to the same key

```
App.tsx:245  request.save  scope=global      defaultKeys=["meta+s","ctrl+s"]
App.tsx:348  env.save      scope=envEditor   defaultKeys=["meta+s","ctrl+s"]
```

`rebuildBindings()` (commands.ts:38) writes into a `Map` keyed by the normalised
combo, so the **last registration wins**. `env.save` is registered second, so it
overwrites `request.save` in the map.

`handleKeyEvent()` then looks the combo up, finds `env.save`, and hits:

```ts
if (cmd.scope === "global" || cmd.scope === activeScope) { ...fire... }
```

`env.save` is scoped `envEditor`, and the active scope is `global` outside the
environment editor — so the branch is skipped, `preventDefault()` is never
called, and `request.save` never runs. **Ctrl+S currently does nothing at all**
(the browser's own "Save page" is not even suppressed).

### 0.2 The text-entry guard is too narrow

```ts
const INPUT_TAGS = new Set(["input", "textarea", "select"]);
if (tag && INPUT_TAGS.has(tag) && !e.metaKey && !e.ctrlKey) return false;
```

Two problems:

- **Modifier chords are never exempted.** Because the guard only bails when no
  modifier is held, every `ctrl+<key>` chord is routed into the command lookup
  *even while the user is typing*. That is how Ctrl+Z gets swallowed (§5).
- **`contenteditable` is not covered.** CodeMirror's editor is a
  `contenteditable` div, not an `<input>`. Chords inside the body editor
  therefore hit the global dispatcher and can be intercepted.

### 0.3 What to change

**a. Detect conflicts at registration time.** `rebuildBindings()` should detect a
second command claiming a combo and prefer the one valid for the current scope
rather than last-wins. Do not silently overwrite.

Proposed: keep `Map<string, Command[]>` (all claimants) and resolve at dispatch
time by scope. If two commands in the *same* scope claim one combo, that is a
programming error and should `console.warn` in dev.

**b. Exempt native editing chords in text-entry contexts.**

```ts
const TEXT_ENTRY_TAGS = new Set(["input", "textarea", "select"]);
const NATIVE_EDIT_CHORDS = new Set(["a", "z", "y", "x", "c", "v"]);

function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag && TEXT_ENTRY_TAGS.has(tag)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest?.(".cm-editor")) return true;   // CodeMirror
  return false;
}
```

When the event target is a text-entry context **and** the chord is one of
select-all / undo / redo / cut / copy / paste, return `false` and let the
browser or CodeMirror handle it natively. Chords that are *not* native editing
(ctrl+enter to send, ctrl+s to save, ctrl+k palette) must still fire from
inside a text field — that is the current and desired behaviour, so the guard
must not become blanket.

**c. Scope the undo/redo exemption to CodeMirror only.**
Plain `<input>`/`<textarea>` have native undo; CodeMirror has native undo too.
Both should keep it. The app-level `edit.undo` remains available outside text
contexts (e.g. the tree, the response panel).

**Files:** `shared/lib/commands.ts`, `shared/hooks/useKeyboardShortcuts.ts`
(scope detection should also treat `.cm-editor` as a distinct scope so
CodeMirror-aware commands can be registered later).

**Tests:** `shared/lib/commands.test.ts` (new). Assert:
- two commands on one combo resolve by scope, not by registration order;
- `ctrl+z` inside a text entry is not intercepted;
- `ctrl+enter` inside a text entry *is* intercepted (send must keep working);
- `ctrl+a` is not bound to any command and is never intercepted.

---

## 1. Large request JSON payloads — scrolling

### Current chain

```
RequestPanel.tsx:46   <div className="flex-1 overflow-y-auto">   <- scroll container
  BodyTab.tsx:124     <div className="flex flex-col h-full">
    BodyTab.tsx:183   <div className="flex-1 min-h-0">
      JsonEditor.tsx:30  <div style={{minHeight:"240px"}} className="h-full flex flex-col">
        JsonEditor.tsx:46  <CodeMirror height="100%" className="h-full" />
```

CodeMirror 6 renders `.cm-editor` as a flex column whose scroller (`.cm-scroller`)
owns the `overflow: auto`. Scrolling only works if `.cm-editor` has a **definite
height**. `height="100%"` from `@uiw/react-codemirror` sets the height of its
outer wrapper, and `.cm-editor { height: 100% }` is only applied if the wrapper
itself is height-constrained.

Two concrete suspects:

1. `JsonEditor`'s root has an inline `minHeight: 240px` with **no `min-h-0`**. In
   a flex column, a `min-height` on the child stops it shrinking below 240px,
   so on a short panel the editor is forced taller than its box.
2. The `h-full` chain resolves against `RequestPanel`'s `overflow-y-auto` wrapper.
   If any ancestor in the chain lacks `min-h-0`, the height is content-derived,
   `.cm-editor` grows to the full document height, and **the outer panel scrolls
   instead of the editor**. With a large JSON every line is mounted, which is
   slow and pushes the response panel off screen.

### Plan

1. **Measure first — do not guess.** Build a throwaway Vite page that renders the
   real `JsonEditor` inside the real `RequestPanel` layout with a 2 MB / 50k-line
   JSON body, and assert with the browser harness:
   - `.cm-scroller` `scrollHeight > clientHeight` (editor scrolls internally);
   - `.cm-editor` `clientHeight` is bounded by the panel height;
   - the response panel below it does not move.
   Record the numbers in the PR description.
2. **Bound the editor.** Replace the ad-hoc `height="100%"` + inline `minHeight`
   with an explicit CodeMirror theme so the constraint lives with the editor:

   ```ts
   const editorTheme = EditorView.theme({
     "&": { height: "100%", minHeight: "0" },
     ".cm-scroller": { overflow: "auto" },
   });
   ```
3. **Fix the flex chain.** `JsonEditor` root becomes
   `className="h-full min-h-0 flex flex-col overflow-hidden"` and the inline
   `minHeight` moves to a `min-h` *floor* that is allowed to be overridden
   (`minHeight` prop → `style={{ minHeight }}` on an inner element, not the
   flex root).
4. **Keep the outer `overflow-y-auto`** as the fallback for small bodies so the
   "Format" button and status row stay reachable.
5. **Guard against pathological payloads.** Above a threshold (say 5 MB) show a
   banner with the byte count and a "still edit" affordance rather than silently
   degrading. Do not truncate the *request* body — the response viewer already
   truncates at 500 KB and the request must stay exact.

**Files:** `shared/components/JsonEditor.tsx`, `features/request/components/BodyTab.tsx`,
`app/layout/RequestPanel.tsx` (if the chain needs adjusting).

**Tests:** a layout regression test is not practical in happy-dom (no layout
engine). Cover it with the browser harness as a scripted check instead, and
keep the measurement script in `flux/frontend/scripts/`.

---

## 2. Ctrl+A selects all, even for very long text

**Finding: this already works.** No command is bound to `ctrl+a`, so the native
select-all in `<input>`, `<textarea>` and CodeMirror is intact. The only risk is
that §0.2's guard means a *future* binding could silently break it.

So the work here is **protection, not implementation**:

1. Add `a` to `NATIVE_EDIT_CHORDS` (§0.3b) so select-all can never be hijacked
   inside a text entry.
2. Add a startup assertion in dev: no command may bind a chord in
   `NATIVE_EDIT_CHORDS` for a scope that overlaps a text entry. Warn loudly.
3. Add a regression test: with a 100k-character URL in the URL bar, dispatch
   `ctrl+a` and assert `selectionStart === 0 && selectionEnd === value.length`.

**Note on "very long text":** the URL bar is a native `<input>` whose visible
text is a separate highlight overlay (`pointer-events-none`), so selection and
caret are unaffected by the overlay. The body editor is CodeMirror, which
handles long documents natively. The real risk for long text is §1 (layout), not
selection.

**Files:** `shared/lib/commands.ts`, `features/request/components/UrlBar.tsx`
(test only).

---

## 3. Detect cURL commands in the URL field

### Design decision — do not auto-replace typed text

Silently rewriting what the user typed is hostile: a paste that *looks* like
cURL but is meant as a literal string would be destroyed with no way back.
**Detect and offer, never auto-apply.**

### Plan

1. **Add a cheap detector to `curlParser.ts`** (exported, unit-tested):

   ```ts
   export function looksLikeCurl(input: string): boolean
   ```
   True when the input's first token is `curl` (case-insensitive) *and* a URL or
   `--url` argument is present. Must be O(n) with no allocation beyond the
   first few hundred characters — it runs on every keystroke.

2. **Detect on paste, not on every keystroke.** In `UrlBar`, add an `onPaste`
   handler that inspects `clipboardData.getData("text/plain")`. If
   `looksLikeCurl(text)` is true, show a dismissible inline chip:
   *“cURL command detected — Import as request”*.
   Only the paste path triggers detection, so the cost is once per paste and
   typing `curl` by hand is unaffected.

3. **Import opens the existing modal pre-filled.** Rather than duplicating the
   import logic, reuse `PasteCurlModal` — add an optional `initialText` prop so
   the chip can open it with the pasted command already in the textarea. The
   user confirms in the familiar UI. `parseCurl` remains the single source of
   truth.

4. **Do not import into the current tab silently.** `PasteCurlModal` currently
   creates a *new tab*. Keep that behaviour for consistency.

**Files:** `shared/lib/curlParser.ts`, `features/request/components/UrlBar.tsx`,
`shared/components/PasteCurlModal.tsx`.

**Tests:** `shared/lib/curlParser.test.ts` (new file — see §6).

---

## 4. Ctrl+S saves the request, with a clear notification

### Root cause

§0.1 — `request.save` and `env.save` both claim `ctrl+s`; the map keeps the
later one, and the scope check then discards it. **Ctrl+S does nothing today.**

### Plan

1. **Resolve the conflict at the engine level** (§0.3a) so both commands can
   legitimately share `ctrl+s`: inside the environment editor, `env.save` wins;
   everywhere else, `request.save` wins. No rebinding needed.
2. **Keep the existing modal flow.** Ctrl+S opens `SaveRequestModal`; the modal
   already toasts `Saved "<name>"` on success and renders an inline error on
   failure. That is the "clear notification".
3. **Strengthen the notification** so it is unambiguous:
   - On success, keep the toast but include the collection, e.g.
     `Saved "Login" to Auth API`.
   - On failure, also `toast.error(...)` — today the error is only inline in the
     modal, so a user who looked away sees nothing.
   - The `toast.success` call must fire **after** `markActiveSaved` so the tab
     title/dirty indicator has already updated when the toast appears.
4. **Prevent the browser default.** `handleKeyEvent` already calls
   `preventDefault()`, but only inside the scope branch. With §0.1 fixed the
   branch is reached, so Ctrl+S will suppress the webview's "Save page".
5. **Verify it fires from inside text fields.** The text-entry guard must not
   block `ctrl+s` — `s` is not in `NATIVE_EDIT_CHORDS`.

**Files:** `shared/lib/commands.ts`, `features/collections/components/SaveRequestModal.tsx`.

---

## 5. Ctrl+Z reverts changes in the URL field

### Root cause

Two independent defects:

1. **The global handler swallows it.** `edit.undo` is bound to `ctrl+z` at
   `App.tsx:300`, scope `global`. In the URL bar the target is an `<input>`, but
   the guard only exempts *unmodified* keys, so the chord is routed to the
   command, `preventDefault()` runs, and the browser's native undo never
   happens. The app's own undo then does nothing either.
2. **The app's own undo is dead code.** `useUndoRedo.pushSnapshot` is exported
   but **never called anywhere** (`grep pushSnapshot` → only the definition and
   the return statement). The undo stack is therefore always empty, so
   `edit.undo` is a no-op even outside text fields.

### Plan

1. **Let native undo work in text fields.** Add `z`, `y` to
   `NATIVE_EDIT_CHORDS` so `ctrl+z` / `ctrl+shift+z` / `ctrl+y` inside an
   `<input>`, `<textarea>` or CodeMirror are handled natively. This alone fixes
   the common case in the URL bar.
2. **Do not rely on native undo alone for the URL bar.** The URL input is
   *controlled*, and its displayed value is derived:

   ```ts
   const displayed = url + buildQueryString(params);
   ```

   `handleChange` splits the value on `?` and rewrites `params`. Native undo
   restores the DOM value, but React re-renders from `url`/`params`, and the
   derived `displayed` can differ from what was restored. Native undo is
   therefore *not* fully reliable here.

   So implement an **explicit URL-scoped history**:
   - New hook `shared/hooks/useFieldHistory.ts`: a bounded stack
     (50 entries) of previous URL values, with `push`, `undo`, `redo`,
     `canUndo`, `canRedo`.
   - Push on each committed change in `UrlBar.handleChange`, coalescing
     consecutive single-character edits into one history entry (debounce by
     "same edit burst" — e.g. treat edits within 400 ms of each other as one
     entry) so one Ctrl+Z removes a word, not one character.
   - `undo()` sets the URL through the store (`setUrl`) so `displayed` stays
     consistent.
   - **Decide precedence:** with §0.3b in place, the global handler will not
     see `ctrl+z` inside the input at all, so the field hook must own it via
     the input's own `onKeyDown`. That is the clean split: native behaviour in
     the DOM, explicit history in the component.
3. **Make the app-level undo real, or remove it.** Two options:
   - (a) Wire `pushSnapshot` into the request store so `edit.undo` genuinely
     undoes request-level edits (params/headers/body/auth) outside text
     fields; or
   - (b) Delete the dead global undo/redo commands and keep undo strictly
     per-field.

   **Recommendation: (b)** for this change set. Request-level undo is a bigger
   feature (it needs snapshot points defined across five stores) and a
   half-working global undo is worse than none. Ship §5 as URL-scoped undo
   only, and file the request-level undo separately. If the maintainer prefers
   (a), it is a contained follow-up once `pushSnapshot` has a defined trigger
   (e.g. on blur of each editor).

**Files:** `shared/lib/commands.ts`, `shared/hooks/useFieldHistory.ts` (new),
`features/request/components/UrlBar.tsx`, `shared/lib/useUndoRedo.ts`,
`App.tsx` (remove the dead `edit.undo`/`edit.redo` registrations if (b)).

---

## 6. Do not unescape nested JSON strings when parsing cURL

### Root cause

`shared/lib/curlParser.ts` → `tokenize()` (lines 49–84) applies a blanket
"backslash escapes the next character" rule to **quoted** strings:

```ts
if (ch === "'" || ch === '"') {
  const quote = ch;
  ...
  while (i < cleaned.length && cleaned[i] !== quote) {
    if (cleaned[i] === "\\" && i + 1 < cleaned.length) {
      buf += cleaned[i + 1];   // <-- drops the backslash
      i += 2;
      continue;
    }
    buf += cleaned[i];
    i++;
  }
```

Real-world failure. A cURL copied from Chrome DevTools:

```bash
curl 'https://api.example.com/messages' \
  -H 'Content-Type: application/json' \
  --data-raw '{"text":"he said \"hi\""}'
```

The shell (single quotes are literal) would pass the body through unchanged.
`tokenize()` collapses `\"` to `"`, producing:

```
{"text":"he said "hi""}
```

which is invalid JSON. The same happens to any JSON containing an escaped
backslash, and to `\n` inside a JSON string.

### Fix — implement POSIX quoting rules

| Context | Rule |
|---|---|
| `'single quotes'` | **Fully literal.** No escape processing at all. The only way to embed `'` is `'\''`. |
| `"double quotes"` | Backslash escapes only `$`, `` ` ``, `"`, `\`, and a newline. Anything else keeps the backslash. |
| unquoted | Backslash escapes the next character (current behaviour is already correct here). |

This is a behaviour change to the tokenizer, so it must be
backwards-compatible for the cases that already work. Note the double-quoted
rule is *stricter* than today: `"a\b"` currently yields `ab`, and under POSIX it
stays `a\b`. That is correct — `\b` is not a shell escape — but it is a
behaviour change worth calling out.

### Plan

1. Rewrite `tokenize()` with the three rules above, as a small, well-named
   helper per rule (e.g. `readSingleQuoted`, `readDoubleQuoted`,
   `readBare`) rather than one loop with branches.
2. **Do not change `parseCurl()`'s public contract.** `RequestState` in, out.
3. **Add `shared/lib/curlParser.test.ts` — this file does not exist today.**
   The parser has no tests at all, which is why this class of bug survived.
   Required cases:
   - nested escaped quotes inside a JSON body (the reported bug);
   - `\\` and `\n` inside a JSON string;
   - literal backslash in a single-quoted body;
   - `'\''` (embedded single quote);
   - double-quoted body with `\"`;
   - backslash line continuations;
   - `-d` with a form-encoded body → `urlencoded` + `bodyForm`;
   - `-H 'Authorization: Bearer x'` → `authType: "bearer"`;
   - `-u user:pass` → basic auth split into user/pass;
   - a URL with a query string;
   - error cases: empty input, no URL.

**Files:** `shared/lib/curlParser.ts`, `shared/lib/curlParser.test.ts` (new).

---

## Sequencing

Each step is independently shippable and independently testable.

| # | Step | Depends on | Risk |
|---|------|-------------|------|
| 1 | Keybinding engine: conflict resolution, text-entry guard, native-edit exemption | — | Medium — touches every shortcut. Needs the new test file to prove no regressions. |
| 2 | `curlParser` POSIX tokenizer + first test file | — | Low — self-contained. |
| 3 | Ctrl+S conflict fix + notification hardening | 1 | Low |
| 4 | Ctrl+A protection + regression test | 1 | Low |
| 5 | URL-scoped undo (`useFieldHistory`) + dead-code cleanup | 1 | Medium — new hook, changes URL editing behaviour |
| 6 | cURL detection chip in the URL bar | 2 | Low |
| 7 | Large-payload scrolling (measure → constrain → verify) | — | Medium — layout work; must be verified in a real browser |

Steps 1–4 and 6 are keyboard/parser work and can land in one PR. Step 5 changes
editing behaviour and deserves its own PR. Step 7 is a layout change and
deserves its own PR with before/after measurements.

---

## Verification

Per step:

- `cd flux/frontend && npm test` — all suites green.
- `cd flux/frontend && npx tsc --noEmit` — clean.
- `cd flux/frontend && npm run build:web` — production bundle builds.
- For layout (step 7) and keyboard (steps 1/5), a scripted browser check in
  `flux/frontend/scripts/` asserting the specific behaviour, since happy-dom
  has no layout engine and no real key handling.

New test files:

- `shared/lib/commands.test.ts` — conflict resolution, text-entry guard.
- `shared/lib/curlParser.test.ts` — the tokenizer rules.
- `shared/hooks/useFieldHistory.test.ts` — push/undo/redo/coalescing.
- `features/request/components/UrlBar.test.tsx` — Ctrl+A selection, Ctrl+Z
  revert, cURL chip.

## Standards

- Match the existing code style: named exports, `cn()` for class composition,
  Zustand stores for state, no new runtime dependencies.
- Every new module gets a colocated `.test.ts` (the repo convention).
- No `any`. Public types exported from the module that owns them.
- Comments explain *why*, not *what* — matching the existing codebase, which
  does this well (e.g. `internal/git/git.go`, `internal/requester/requester.go`).

## Open questions for the maintainer

1. **Ctrl+S behaviour** — open the Save dialog (current flow) or save straight
   to the last-used collection with an undo toast? The plan assumes the dialog.
2. **Request-level undo** — ship URL-scoped undo only (recommended), or wire up
   the dead `useUndoRedo` for the whole request?
3. **cURL detection trigger** — paste only (recommended), or also on blur when
   the field happens to contain a cURL command?
4. **Large-payload threshold** — what size should trigger the "this is a large
   payload" banner? 1 MB, 5 MB, or no banner at all?
