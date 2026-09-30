# Vibed × OpenCode v2 release compatibility (0.14.0)

**Date:** 2026-09-30
**Scope:** `main.js`, `manifest.json`, `README.md`
**Trigger:** OpenCode v2 left beta; released servers (verified against **2.0.20**) broke the plugin's v2 connector — sessions showed "offline" in session mode.

## Root cause

The released v2 API dropped `GET /api/health`. Vibed's server discovery probed `/api/health` and expected `{healthy: true}`, so every probe failed and the connector never resolved an endpoint — "offline" everywhere, even with a healthy local server.

## What changed (verified live against the running 2.0.20 server)

| Area | Beta (what vibed did) | Released v2 (now) |
| --- | --- | --- |
| Discovery/health | `GET /api/health` → `{healthy}` | `GET /api/info` → `{version, pid, urls}` |
| Permission reply | body `{reply}` | body `{decision}` (values already `once`/`always`/`reject`) |
| Server-disposed event | `server.instance.disposed` | `global.disposed` |
| Question tool | REST fallback `/api/session/:id/question` | forms only (`/api/session/:id/form`) |
| Transcript noise | — | new `"idle"` marker messages filtered out at render |
| Prompt echo | `timeCreated` | `time.created` |
| List refresh events | + dead beta names | added `session.updated`/`session.status`/`session.idle`; removed `permission.v2.*`, `question.v2.*`, `session.removed` |

Beta-compat removals per Roman's call: the question REST protocol (`sessionQuestions`/`replyQuestionRequest`/`rejectQuestionRequest`, `normalizeQuestionRequests`, protocol probing in `pendingQuestions`) is gone — released servers 404 those endpoints and surface the `question` tool as a form, which vibed already speaks (`form.created` payload `data.form` matches `normalizeForms` field-for-field).

## What was verified compatible (no change needed)

- Basic auth `opencode:<password>` from `~/.local/state/opencode/service.json` — unchanged
- SSE wire protocol: per-step streaming (`session.step.*`, `session.text.*`, `session.reasoning.*`, `session.tool.*`, `session.usage.updated`, `session.inbox.*`) — captured live, matches the view's handlers exactly
- `session.execution.started/succeeded/failed/interrupted` state events — still emitted
- `{data, cursor}` envelopes for sessions/messages; `location[directory]` query encoding on `/api/model`, `/api/agent`
- Model.Ref object shape (`{id, providerID, variant}`) in sessions, `POST /model`, `POST /agent`, `POST /api/session` create
- Prompt `{text}`, interrupt, form reply `{answer}` — exercised end-to-end on a probe session (created, prompted, question→form→reply, deleted)
- SQLite layer: `session_v2`/`session_message` schemas and the `$.time.completed` state heuristic unchanged

## Verification

- `node --check main.js` ✓
- `node scripts/dashboard-smoke.js` ✓ (all dashboard paths)
- Extracted `OpenCodeClient` run live against 2.0.20: resolve/health/permission-reply/pendingQuestions/list/messages/models/agents/default/active all pass; bogus-id replies return 404 (shape accepted, not 400) ✓

## Notes

- Auth on released v2 is Basic (`opencode:<password>`) or `?auth_token=` query param — Bearer is rejected 401. Vibed already sent Basic.
- The published https://opencode.ai/v2 openapi now tracks master, which is slightly ahead of installed releases (it still lists no question REST routes; question events return as `question.v2.*` there). Vibed targets installed release builds.
