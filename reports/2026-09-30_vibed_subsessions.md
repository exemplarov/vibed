# Vibed 0.15.0 — subsession hierarchy

**Date:** 2026-09-30 (released 2026-10-01)
**Scope:** `main.js`, `styles.css`, `scripts/dashboard-smoke.js`, `manifest.json`, `README.md`
**Commits:** d67ba03, 4b3f23f — released as [0.15.0](https://github.com/exemplarov/vibed/releases/tag/0.15.0)

## What was built

Task-tool subagent sessions ("subsessions", `session_v2.parent_id` / API `parentID`) are now first-class hierarchy in vibed:

1. **Hierarchical lists** — subsessions no longer mix with main sessions; they nest under their parent's card. Children whose parent isn't in the current rows (filtered-out directory, pinned widget) stay top-level — never silently dropped.
2. **Parent signal** — a running parent with active children shows the derived state **"Subagents running"** (accent-tinted badge/card border). OpenCode has *no* dedicated server status for supervision (verified live: parent and child both report `"running"` in `/api/session/active`, `SessionActive.type` enum is `running` only) — the signal is derived client-side. `is:running` still matches delegating parents.
3. **Card subsession strip** — active/ongoing subsessions listed by default (state dot · title · agent · model, click opens the child chat); expand/collapse toggle shows all. Table layout nests the same strip in a colspan sub-row.
4. **Chat header** — a session with a parent shows a `⑂ subsession` chip that opens the main session (works for API `parentID` and offline-DB `parent_id` paths).

## Verification

- Live ground truth on opencode 2.0.20: ran a real task-tool subagent (parent `ses_f0dc5e179ffe…` + child), captured `session.created` carrying `parentID`, child streaming events on the same SSE, both parent and child `"running"` in active sessions. Probe sessions deleted after.
- DB: 866 real subsessions present; eidolon parent `ses_f28afe171ffe…` currently has 2 running review subsessions — live test case for Roman.
- Logic tests: grouping (nesting, orphan fallback, order), delegation derivation, idempotent re-render (rawState preserved — first draft had a mutation bug caught in review), revert-to-running when children finish, idle-parent-with-waiting-child edge.
- Smoke suite: new check `subsessions nest under the parent and derive delegating state` (collapsed default, expand, orphan visibility). All pass.

## Notes

- Live updates: `session.created` / `execution.*` / `form.*` events already trigger the debounced list reload, so children appear and states flip without new event plumbing.
- 2026-10-01: confirmed live by Roman — two `general` subagents ran `sleep 30` from this very session while he watched the card (badge, strip, child-chat chip, expand toggle all verified). Released 0.15.0. The overnight store-update collision (Obsidian updater overwrote the dev sync with release 0.14.0) resolved: vault clone reset to origin/main, store and vault now both at 0.15.0, `.hotreload` marker in place.
