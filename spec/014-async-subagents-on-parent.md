# spec/014 — Async subagents visible on the parent session page

Status: implemented (v0.23.0)

## Problem

A background (`background: true`) subagent outlives the parent's own turn:
the tool call returns immediately, so the parent fires
`session.execution.succeeded` and its live state settles on **idle** while
the child session keeps working. Observed in the wild
(`ses_e2b01712dffevwfthBbJVGFnxv`, 2026-11-14): the dashboard card's
subsession strip correctly said "1 of 1 subagents running", but the parent
session page showed only an "Idle" badge — nothing on the page hinted that
work was still in flight. The TUI lists running terminal tasks/subagents on
the session view; vibed's parent page had no equivalent.

Two derivation gaps caused it:

1. **Badge (`renderBadge`)**: state came from `busy`/live state plus
   descendant *blockers* (spec/011 asks/questions) — no notion of
   descendants simply *running*.
2. **Dashboard (`groupSubsessions`)**: the parent's `delegating` derivation
   required `rawState === "running"`; an async-delegating parent is
   `idle`, so the card read "Idle" despite active children.

## Design

**Driver (`OpenCode2Driver`)**

- `activeDescendants(sessionId)` — scans `liveStates` for sessions in an
  `ACTIVE_STATES` state whose ancestor chain (`ancestorChain`, cached)
  contains `sessionId`; fetches each hit's title/agent. Returns
  `[{ id, state, title, agent }]`. Runs are cheap: active sessions are few
  and parent links are cached.

**Event fan-out (`DESCENDANT_EVENT_TYPES`)**

- Adds the four `session.execution.*` lifecycle events, so a parent view
  hears when a background child starts/ends. Views distinguish re-delivered
  events the established way — `data.sessionID !== this.sessionId` — so the
  execution handlers in `onServerEvent` guard foreign ids: they must not
  flip the parent's own `busy`; they re-probe
  `refreshPendingDescendants()` instead.

**View (`SessionChatView`)**

- `descendantActive[]` mirrors in-flight descendants; hydrated on load,
  reconcile, and descendant execution events via `refreshPendingDescendants`
  (which now probes blockers and active children independently — one
  failing must not discard the other's result).
- Badge: after blockers and own-busy, a non-busy parent with active
  descendants reads `delegating` ("Subagents running"). A **busy** parent
  keeps `running` — its own live stream outranks the children; foreground
  delegation is unchanged.
- Banner: a "Subagent(s) running in the background" section in the
  spec/011 subagent banner — one quiet row per child (title · agent ·
  Open), jumping to the child session. Composer hint mirrors it while the
  parent is not busy.

**Dashboard (`groupSubsessions`)**

- `delegating` now derives for parents whose `rawState` is `running` **or**
  `idle` with active children. Terminal parent states (error, interrupted,
  suspended, archived) keep their label — the parent's own outcome
  outranks in-flight children.

## Non-goals

- Stopping a background child from the parent page (open the child — its
  own Stop acts there).
- Streaming child message deltas into the parent transcript (unchanged
  spec/011 non-goal).

## Testing

- `node --check` + `node scripts/dashboard-smoke.js` green.
- Live harness against the running server: parent spawns a background
  child (`parentID` set, parent's execution already succeeded); verify
  (a) `activeDescendants(parent)` returns the child while it runs,
  (b) the parent view badge reads "Subagents running" with the strip
  listing the child, (c) the child finishing clears both, (d) the
  dashboard card reads "Subagents running" instead of "Idle" while it
  runs.
