# 007 — Snippet Session Config

Status: implemented
Date: 2026-10-01
Applies to: Vibed ≥ 0.16.0

## 1. Goal

Let a `vibed` code block carry **session configuration** — model, agent,
permissions, environment (ephemeral, per session) plus skills, commands,
agents, MCP servers, providers, references (desired state at the session
root) — and have sessions started from that block pick it up:

- Snippet has **no config keys** → behavior unchanged, no dialogue, ever.
- Snippet config **matches** the directory's live state → start silently.
- There **is a diff** → one dialogue: install everything needed (config
  merge, skill installers) or close and proceed as-is. The dialogue
  re-appears on every session start while a diff exists — no dismissal
  memory, nothing persisted about consent.

The snippet is checked at **session-start time** (the first message that
creates the server session), so abandoned drafts never write anything.

## 2. Non-goals (v1)

- No writes to any file OpenCode discovers other than
  `<root>/.opencode/opencode.json`; the only other write is the
  vibed-owned manifest `<root>/.opencode/vibed.json` (§6). Ancestors,
  global config, `AGENTS.md` are never touched.
- No remote-connector installs (server-side `fs/write` + `shell`): the
  dialogue renders the diff but Install is disabled with an explanation
  when the connector's server is not local.
- No inline skill bodies materialized as files (paths/URLs and install
  commands only).
- No management of the local file beyond merge/retract of the snippet's
  own keys (§5); user-authored keys are never deleted.
- No secrets in snippets: authors must use OpenCode's `{env:VAR}`
  substitution. The dialogue never renders values read from the live
  config (they can contain API keys) — only key paths, change kinds, and
  the snippet's own declared values.

## 3. Snippet keys

Recognized config keys, split by lifetime:

| group | keys | destination |
| ----- | ---- | ----------- |
| ephemeral | `model`, `agent`, `permissions`, `environment` | `POST /api/session` body (+ `PUT /api/session/:id/environment` after creation) — resent on every start, never gated by the dialogue |
| root state | `default_agent`, `agents`, `mcp`, `providers`, `commands`, `references`, `skills` | desired state of the session root, diffed and optionally written into `.opencode/opencode.json` |

`model` is `provider/model[#variant]` (or the object form). It and `agent`
prefill the draft's selectors (user may still change them — snippet values
are defaults, applied at creation when the selectors hold them).
`permissions` is an OpenCode ruleset array passed through verbatim.

`skills` entries are either:

- a **string** — path/URL added to the config `skills` sources (relative
  paths resolve against the session root);
- an **object** `{id?, install}` — a shell command run once to install
  (e.g. `npx skills add owner/repo`). `id` is the skill id that
  `GET /api/skill` lists; see §7.

The simple line format gains inline-JSON values (`mcp: {"kangram": …}`,
`- {install: "npx …"}`); rich configs can also spell the whole block as a
JSON object, which the parser already supported.

Extraction (`extractSnippetSessionConfig`) throws on malformed entries —
the dashboard's New-session click surfaces that as a Notice.

## 4. Gate flow (session-start time)

`sendDraft` — the moment the server session is about to be created —
runs `runSnippetConfigGate(client, directory, snippet)`:

1. Read-only checks, in parallel: `GET /api/config?location[directory]=`
   (the ordered discovery chain: global → ancestors → local, each parsed)
   and `GET /api/skill?location=` (installed skill ids).
2. Effective config = deep-merge of every document in the chain, in order.
3. Diff = subset comparison of the snippet's root-state keys against the
   effective config (only paths the snippet names; deep equality; arrays
   are leaves, except `skills` which uses source-subset semantics).
4. Skill installs checked per §7; `skills` sources checked by subset.
5. No diff at all → return, session is created normally.
6. Diff → `SnippetConfigModal`:
   - **Install & start** — apply (§5), install (§7), reload, verify
     (§8), then create the session.
   - **Proceed as-is** — create the session on the existing config.
   - ESC / backdrop during the choice phase = cancel (the message stays
     in the composer). Cancelling during the install phase lets the
     spawned installers finish (they are detached); the next start
     re-checks state.

If the pre-check calls fail (server unreachable) the gate degrades to
proceed-as-is — session creation itself will surface the error.

## 5. Config apply (merge & marker)

Target file: `<root>/.opencode/opencode.json` — the highest-precedence
slot in OpenCode's discovery, so writes always win without touching any
other file. Rules:

- File missing → created with the desired overlay.
- File present and plain JSON → desired overlay deep-merged in; keys the
  snippet no longer wants are retracted **only** if the marker says vibed
  placed them.
- File present but JSONC/unparseable → install refuses with a clear
  message (manual merge); skill installs still run.

Marker: `"x-vibed": {"managed": true, "keys": ["mcp.servers.kangram", …]}`
records the dot-paths vibed placed in this file. After every apply the
marker is rewritten to exactly the currently-desired paths.

`skills` array merge is **union** (existing sources ∪ desired sources),
never replacement — the local file must not shadow sources provided by an
ancestor.

## 6. Manifest (learned installs)

`<root>/.opencode/vibed.json`, owned by vibed:

```json
{ "installs": [ { "command": "npx skills add owner/repo", "ids": ["deep-research"] } ] }
```

`ids` are learned on the first consented install: the skill list is
snapshotted before and after each command, and the delta is recorded
against the normalized command string (whitespace-collapsed). An empty
delta is a success (idempotent installer) and is recorded as such.
Commands are keyed exactly — editing the command re-asks and re-learns.

## 7. Skill install satisfaction

Before the dialogue, each `{id?, install}` entry is classified:

- declared `id` present in `GET /api/skill` → satisfied;
- no `id`, but a manifest entry with the same normalized command has all
  its learned ids still present → satisfied;
- otherwise → **diff** (unknown or missing). Unknown commands always
  count as a diff — "unknown = diff" is what keeps the no-false-silent
  guarantee honest.

Installs run sequentially through a shell in the session root
(`spawn(cmd, {shell: true, cwd: root, detached: true})`), output streamed
into the dialogue. After each command the skill list is re-fetched to
learn its delta (§6). Closing the dialogue never kills a running
installer.

## 8. Reload & verify

After applying: `POST /api/location/reload`. Verify by re-fetching the
chain + skill list and re-running the diff — the dialogue reports
"applied, config matches" or the remaining gaps (e.g. an installer that
produced nothing). Verification is also what feeds the manifest delta.

## 9. Redaction

The dialogue renders, per change: dot-path, add/change kind, and the
snippet's own desired value (truncated). It never renders values read
from the live config — `GET /api/config` responses contain credentials
(API keys, auth headers). Structure only.

## 10. Capabilities & degradation

| situation | behavior |
| --------- | -------- |
| no config keys in snippet | unchanged UX |
| server unreachable at check | Notice + proceed as-is |
| remote (non-loopback) server | diff shown, Install disabled with note |
| existing config unparseable | config merge refused with message; installs still offered |
| install command fails | error logged in dialogue; Start session (as-is) still available |

## 11. Privacy delta

The plugin's stance changes from "nothing outside your vault is
modified" to: vibed writes `<root>/.opencode/opencode.json` and
`<root>/.opencode/vibed.json`, and runs the snippet's skill-installer
commands — **only** in directories you start snippet-configured sessions
from, **only** after the explicit Install click. The README privacy
section says exactly this.

## 12. Open questions / follow-ups

1. **Remote installs** via `POST /api/experimental/fs/write` +
   `POST /api/shell` (both location-scoped) — the natural v2 once the
   local flow is proven.
2. **Upstream ask**: per-session config override on `POST /api/session`
   (draft in `spec/upstream-per-session-config-issue.md`) would collapse
   the whole install machinery into "pass it every time".
3. ~~Which reload call wins~~ — resolved during implementation (verified
   live): `POST /api/location/reload` refreshes discovery for any
   previously-queried location; the written file shows up in the chain
   immediately after. Also verified: the server schema-validates config
   documents, so a snippet key with an invalid shape is dropped from the
   chain — the verify pass then reports it as still missing, which is the
   honest failure mode.
