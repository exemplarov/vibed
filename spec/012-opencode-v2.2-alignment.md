# spec/012 — OpenCode v2.1–v2.2 API alignment

Status: in progress

Source: changelog audit 2026-11-09 (`reports/2026-11-09_vibed_opencode-changelog-audit.md`),
verified against a live v2.2.x server (PATCH verb, `archived` query param,
`time.archived`, `session/global/form`, model `type` all probed 2026-11-10).
Five features, each shippable independently.

## 1. Archived sessions (default hidden, opt-in widget flag)

Status: implemented

Notes: pre-v2.1.0 servers ignore the `archived=false` query param and never
send `time.archived`, so archived rows there still appear (labelled Idle) —
acceptable degradation. A connector-level `customSql` ANDs with the built-in
`time_archived IS NULL` clause; only the block-level `archived: true` flag
lifts the built-in one. `session.archived`/`session.unarchived` trigger list
refreshes (harmless no-ops on older servers).

Upstream: v2.1.0 restored archiving (`?archived=true|false` on
`GET /api/session`; omit → both); v2.2.6 `opencode run --archived` creates
pre-archived CI sessions. The TUI hides archived by default; vibed showed
them everywhere (DB listing has no filter; API listing omits the param so it
gets *both*).

- `GET /api/session`: vibed passes `archived=false` by default. When the
  widget flag is set the param is omitted (both — archived rows render,
  labelled).
- `listSessionsFromDb`: default gains `time_archived IS NULL`; widget flag
  lifts it. Explicit `sessions:` id lists are never archive-filtered
  (deliberate pins).
- `apiSessionRow` maps `session.time.archived` → `time_archived` (was
  hardcoded null — the API exposes it since v2.1.0).
- Widget/block DSL: new boolean key `archived: true` → include archived
  rows. Updates: `VIBED_BLOCK_KEYS`, `composeVibedBlock`, README tables,
  `AGENT_REFERENCE_MD`, AGENTS.md quick reference (three-places rule).
- State vocabulary: `time_archived` rows read as state `archived`
  ("Archived" label), like `suspended` today — shown only when otherwise
  idle. Filter token `is:archived` works against it.

## 2. MCP elicitation forms

Status: implemented

Notes: `normalizeForms` also passes `placeholder` (string fields) through to
the custom-answer input. The reply target pins the directory captured at
poll time; pre-2.1.4 servers latch off the global route on first 404 so the
probe never repeats.

Upstream v2.1.4: MCP servers can ask for input mid-tool-call via forms.
Field schema (packages/schema/src/form.ts): `string` (+`format`
email/uri/date/date-time, optional `options`, `custom`), `number`,
`integer`, `boolean`, `multiselect`, `external` (**`url`** — a link to
open, submit acknowledges). Elicitations are Location-owned and served
under the undocumented-but-shipping session id `"global"`
(`GET /api/session/global/form` + `location[directory]`, same
reply/cancel routes — form-location middleware).

- `normalizeForms` passes through `url` and `format` on the normalized
  question shape.
- Question banner: external fields render their `url` as a clickable link
  (opens the system browser) next to the existing acknowledgement note.
- Chat view polls the session's location for global forms alongside its own
  (`refreshPendingQuestion` extension). A pending global form renders in
  the same banner titled "MCP server asks". Reply/cancel address
  `"global"`. Any 4xx/404 from older servers degrades silently — the
  endpoint is undocumented upstream.
- Live `form.created` events for elicitations don't carry the chat
  session's id, so polling (existing triggers + reconnect reconcile) is
  the delivery path.

## 3. Session rename + archive actions

Upstream: `PATCH /api/session/:id` with `{title?, metadata?, permissions?,
archived?}` → 204 (verb verified live; PUT/POST 404). Events
`session.archived` / `session.unarchived` exist; `session.renamed` is
already handled.

- Client: `updateSession(sessionId, {title?, archived?})` — PATCH, no
  dialect probe needed (404 vs 405 was empirically unambiguous, and older
  v2 servers that lack it simply 404 → notice).
- Chat header ⋮ menu gains: **Rename…** (modal, empty submit disabled;
  server regenerates when vibed sends a non-empty title), **Archive** /
  **Unarchive** (toggled by current `time.archived` state).
- `session.archived`/`session.unarchived` join `LIST_REFRESH_EVENTS`;
  archived event also flips the local row so open views update without a
  refetch.

## 4. Model picker hides non-chat models

Upstream: model `type` is optional on `Model.Info`; **unset means chat**;
"Only chat models are offered for sessions". Since v2.2.2 image models are
in the catalog by default.

- The composer/session model menu skips any model whose `type` is set and
  not `"chat"` (e.g. `image`, `decision`, future types). Variants of a
  skipped model are skipped with it. Snippet `model:` refs are untouched —
  explicit user intent wins.

## 5. Tool output file blocks (incl. generated images)

Upstream: tool `state.content` blocks are `text` or `file {uri, mime,
name?}` (packages/schema/src/tool.ts). `image_generate` (default-on since
v2.2.2) returns file blocks; vibed dropped everything but text.

- `renderToolOutput` renders `file` blocks:
  - `image/*` mime → inline `<img>`: `http(s)://` and `data:` uris used
    directly; local paths via Obsidian's `app://local/` scheme (desktop
    plugin). Broken/missing local files degrade to the chip.
  - everything else (and non-previewable images) → chip with name/mime
    and an open action (URLs in the system browser via `window.open`;
    local paths via the existing spawn-based opener used for directories).
- Styles: `.oc-tool-file` chip + img sizing in styles.css.
