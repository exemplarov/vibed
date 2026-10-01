# 2026-10-01 — vibed: snippet session config (0.16.0)

## What was built

`vibed` blocks can now configure the sessions they start (spec/007):

- **Ephemeral keys** — `model`, `agent`, `permissions`, `environment`:
  ride on `POST /api/session` (+ `PUT …/environment`) every start; model
  and agent prefill the draft selectors. Never gated, never written.
- **Root-state keys** — `skills`, `mcp`, `commands`, `agents`,
  `providers`, `references`, `default_agent`: desired config of the
  session root. At first send, a read-only diff against the live
  location (`GET /api/config` chain + `GET /api/skill`); match → silent,
  diff → dialogue (Install & start / Proceed as-is, always re-asks).
- **Install** — deep-merge into `<root>/.opencode/opencode.json` with an
  `x-vibed` marker (user keys never deleted; retraction only for
  marker-owned paths the snippet dropped), skills-union semantics,
  detached shell installs with streamed output, learned manifest
  (`.opencode/vibed.json`) keyed by normalized command, reload, verify.
- Dialogue redaction: live config values (credentials!) never rendered —
  key paths, kinds, snippet-declared values only.
- Simple block format gained inline-JSON values and list items
  (`mcp: {…}`, `- {install: "npx …"}`).

Design decisions were brainstormed with Roman in-session: no workspace
dirs (in-place at the session root), no apply policies or dismissal
memory (the diff is the gate; always re-ask), fully structured schema,
local-server-only installs (remote = diff shown, proceed as-is).

## Verification

- `node --check main.js`, `node scripts/dashboard-smoke.js` — extended
  with 7 new checks (parser, extraction, chain merge + subset diff,
  skills subset, install satisfaction, model-ref, deep merge): all pass.
- Scratch-dir applier suite (12 checks): fresh apply, marker rewrites,
  user-key survival, retraction, skills union, manifest cycle,
  self-satisfying diff — all pass. Caught one real bug: retraction used
  the unsatisfied-changes set instead of the full desired set (a
  skills-only apply would have retracted still-desired config). Fixed
  via `rootStateLeafPaths`.
- Live e2e against the real v2 server in a scratch dir: read-side diff →
  apply → `POST /api/location/reload` → server-visible chain matches
  the snippet. Also confirmed: reload refreshes any queried location;
  the server schema-validates config (invalid shapes drop out of the
  chain — verify reports them honestly).

## Files

- `main.js` — snippet-config section (extract/merge/diff/manifest/fs),
  4 client methods, `SnippetConfigModal` + applier + gate, view/plugin
  wiring through picker → draft → `sendDraft`.
- `styles.css` — dialogue styles.
- `spec/007-snippet-config.md` (new), `spec/upstream-per-session-config-issue.md`
  (draft upstream ask: per-session config at `POST /api/session`).
- `README.md` + `manifest.json` — 0.16.0, new section + options row,
  privacy section updated honestly (writes outside vault now possible,
  only after explicit Install).

## Follow-ups

- Remote installs via server-side `fs/write` + `shell`.
- File the upstream issue (draft ready).
- Untested in real Obsidian UI (modal visuals) — needs a manual pass in
  the vault before release.
