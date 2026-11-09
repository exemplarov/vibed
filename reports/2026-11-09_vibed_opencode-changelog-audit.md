# vibed × OpenCode v2.0.26–v2.2.6 changelog audit

Scope: every changelog entry from v2.0.26 (2026-10-08) through v2.2.6
(2026-11-06), cross-checked against main.js @ 0.21.1. Goal: find items that
need code changes or new support in vibed's OpenCode v2 connector/chat.

Sources: repo `CHANGELOG.md`, `gh release view v2.2.6`, the 2.0 announcement
(anoma.ly/notes/opencode-2-0).

## Verdict

No breakage. The v2.1.0 breaking contract renames don't touch any field vibed
reads. Five real gaps found (B1–B5), all additive features rather than
regressions, plus a few watch items.

## A. Verified safe — no action needed

| Change | Why vibed is unaffected |
| --- | --- |
| v2.1.0: replay data renamed `state`→`native`, `providerState`→`native`, `resultState`→`native`; tool parts merge into `tool.native` | vibed never reads any of those fields; it renders `tool.state.{status,input,content,error}` — execution state, explicitly *not* renamed by upstream |
| v2.1.0: compaction `recent` → `metadata.keepID`; `providerContext` → `native.messages` | vibed renders compaction notes from `msg.text` only; never reads `recent`/`providerContext` |
| v2.1.0: `session.compacted` event removed | never subscribed |
| v2.1.0: `idle` added to message type filter | vibed already skips `type === "idle"` rows (run-lifecycle markers, main.js ~7061) |
| v2.1.0+: command payload `{name,text}`→`{command,arguments}`, MCP actions `/api/experimental/mcp`→`/api/mcp` | dialect sniffing with cached shape already in place (spec/009) |
| v2.2.0: `/api/info` gains `hostname` | vibed reads version/pid; extra field ignored (free to display later) |
| v2.0.27: pre-step execution failures surfaced as messages | covered by assistant `msg.error` rendering + `execution.failed` live state |
| v2.2.6: `/api/*` origin sandboxing, media as sandboxed downloads | vibed speaks Node sockets (no Origin header — like curl); it renders no media via the API |
| v2.2.0: media_blob / media URIs (experimental) | attachments render as name chips only; nothing inline to break |
| v2.1.0/v2.2.6: archived sessions hidden from server session list | API listing mode matches the server's own filtering |
| v2.2.1: `/goal` | it's a server slash command; vibed routes `/…` through the command endpoint when listed |

## B. Needs code changes

### B1. Archived sessions pollute DB-backed dashboards (real divergence)

`listSessionsFromDb` (main.js ~2536) selects all rows — no
`time_archived IS NULL` filter — while since v2.1.0 the server hides archived
sessions from the default list, and since v2.2.6 `opencode run --archived`
(CI/scripted runs) creates sessions *already archived*. Those runs will
clutter every DB-backed vibed dashboard while the TUI hides them.
`apiSessionRow` also hardcodes `time_archived: null` for API rows.

Fix: default `time_archived IS NULL` in the SQL, add an `is:archived` filter
token (opt-in), optionally an "Archived" state label + `session.update`
archive/unarchive action (pairs with B3).

### B2. MCP elicitation forms (v2.1.4)

Forms now carry MCP elicitation requests during tool calls: text, number,
choice, multiselect, boolean, **and URL requests**. `normalizeForms` handles
everything except URL-style fields — they'd render as a plain custom-text
input with no clickable link. Verify field shape (`metadata.kind ===
"elicitation"`?) against a live v2.2.x server, then add a URL field type
(clickable link + done/ack).

### B3. Session rename / archive actions missing

Server has `client.session.update` (title since 2.0, archived since v2.1.0);
desktop got rename (Ctrl+R) and delete in v2.2.0. vibed *listens* to
`session.renamed` but can't trigger one, and has no archive/hide. Natural
home: dashboard card menu / chat header menu (specs 006).

### B4. Image-generation models in the model picker

Since v2.2.1→v2.2.2 `image_generate` is default-on and image models appear in
`/api/model`; v2.2.0 added a `?type=` filter for exactly this. vibed's
composer model menu lists every model — image/decision models become
selectable as the session's chat model. Fix: filter by type (or badge).

### B5. Tool-output image blocks dropped

`renderToolOutput` renders only `text` blocks. `image_generate` results (now
the flagship tool) are silently dropped from tool parts. Render image blocks
(whatever `state.content` carries: path/URL/base64).

## C. Watch items / nice-to-haves

- **`SessionInfo.time.busy` (v2.2.1/2.2.2)** — elapsed-time on running cards
  ("Running… 4m"); confirm the field rides `/api/session` items; DB mode has
  no equivalent.
- **`retryAfterMs` in structured session errors (v2.1.2)** — show "retry in
  Xs" when a prompt fails on quota/rate-limit instead of the bare error.
- **Windows service fallback ports** — server defaults moved 45278
  (v2.0.30) → 28894 (v2.1.3); vibed falls back to 49374/4096 only.
  service.json discovery covers it in practice; adding ports is a one-liner
  robustness win.
- **Deleted-session 404 eviction (v2.2.3 desktop behavior)** — an open chat
  view on a deleted session currently surfaces error text; evict like
  desktop does (close view + drop from list).
- **Artifacts (v2.2.4, opt-in)** — render as normal tool parts today; an
  "open artifact" affordance only if the feature graduates.
- **Persistent terminals / PTYs (v2.1.0+) — out of scope** (no terminal
  embedding in vibed).

## Follow-up

B1–B5 would become spec/012 (one spec, one shipping unit) per the
spec-before-ship rule.
