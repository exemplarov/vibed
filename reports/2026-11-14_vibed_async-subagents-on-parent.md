# 2026-11-14 — vibed: async subagents visible on the parent session page (spec/014)

## Report

Session `ses_e2b01712dffevwfthBbJVGFnxv` (scratcherverse) had background
subagents running, but its chat view showed only an "Idle" badge — nothing
on the page hinted at in-flight work. The dashboard card showed the
subsession strip ("N of M subagents running") but the state label read
"Idle" as well.

## Root cause

A `background: true` subagent outlives the parent's turn: the parent fires
`session.execution.succeeded` immediately, its live state settles on
`idle`, and the child keeps running as its own session. Two derivations
only understood "parent busy while children run":

1. `renderBadge` — parent state came from `busy`/live + descendant
   *blockers* (spec/011); descendants simply *running* were invisible.
2. `groupSubsessions` — `delegating` required `rawState === "running"`.

Verified against the live server (v2.2.7, port 49374): the session has 4
background children with `parentID` set (listing **and** single GET), so
the parent-chain attribution works; only the client derivations were
blind. (Aside: `~/.local/share/opencode/opencode.db` has no rows after
2026-09-21 — the live server no longer writes sessions there, so DB-based
listings are stale; unrelated to this fix but worth a look later.)

## Changes (spec/014, `spec/014-async-subagents-on-parent.md`)

- `OpenCode2Driver.activeDescendants(id)` — active descendants (via
  `liveStates` + cached ancestor chains) with title/agent for display.
- `DESCENDANT_EVENT_TYPES` += the four `session.execution.*` events;
  parent views re-probe on them, and `onServerEvent` guards foreign
  sessionIDs so a child's lifecycle never flips the parent's own `busy`.
- `SessionChatView.descendantActive[]`, hydrated on load/reconcile/events
  (`refreshPendingDescendants` probes blockers and active children
  independently); badge `delegating` ("Subagents running") when a non-busy
  parent has active children — a busy parent keeps `running`.
- Subagent banner gains a "Subagent(s) running in the background" section:
  one row per child (title · agent · Open), TUI terminal-tasks parity.
  Composer hint mirrors it. New styles for the quiet sub-rows.
- Dashboard: `delegating` derives for running **or idle** parents with
  active children; terminal parent states (error/interrupted/suspended/
  archived) keep their label.

## Checks

- `node --check main.js` ✓
- `node scripts/dashboard-smoke.js` ✓ — added "idle parent with running
  child derives delegating (async subagents)" + error-parent keeps state.

Not released — manifest stays 0.22.0; spec marked "implemented
(unreleased)". Next release cuts the version bump + README/AGENT_REFERENCE
pass is not needed (no DSL change).
