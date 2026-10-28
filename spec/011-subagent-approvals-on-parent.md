# spec/011 — Subagent approvals surfaced on the parent thread

Status: implemented (v0.21.0)

## Problem

When a task-tool subagent parks a permission ask (or a `question` form), it
belongs to the **child** session: `permission.asked` / `form.created` carry
the child's `sessionID`, and the pending request lists under
`GET /api/session/:child/permission|form`. The OpenCode TUI projects the
subagent stream into the parent thread, so a human watching the parent sees
the approval prompt exactly where the subagent's work appears. vibed routed
these strictly by `sessionID`: the ask surfaced only in the child's own chat
view, and the parent chat showed nothing while its turn sat blocked —
observed in the wild as "questions were shown in subagent sessions, not
parent (but TUI shows them on parent thread)".

The dashboard already nests child cards (spec/0.15.0 subsession hierarchy)
with per-child states, but the parent card only derives `delegating`
("Subagents running") — a child blocked on approval does not change it.

## Goals

1. A parent chat view shows a banner when any **descendant** session (direct
   child or deeper) has pending permission asks — with working
   Reject / Always allow / Allow buttons that reply against the child
   session, and an "Open subsession" jump.
2. A parent chat view shows a banner when a descendant has a pending
   question form — answer flow stays in the child view (the form UI is
   per-session); the parent banner links to it.
3. Recovery without events: banners rehydrate from the server on view load
   and after stream reconnects (the stream does not replay asks, see
   spec/020-adjacent fix in 0.20.1 — same class of gap).
4. The dashboard parent card reflects blocked children: a child
   `waiting`/`question` re-states the parent as "Subagent needs approval" /
   "Subagent needs answer" (outranking `delegating`).

## Design

**Driver (`OpenCode2Driver`)**

- `parentOf(sessionId)` — cached `sessionID → parentID|null`, resolved via
  `GET /api/session/:id` (`parentID` field).
- `syncBlockedStates(sessionIds)` (extends 0.20.1's `syncBlockedPermissions`)
  probes every **active** session's permission **and** form lists on each
  stream (re)connect: sets liveState `waiting`/`question` (healing missed
  events) and records `blockedAsks: Map<sessionID, request[]>` and
  `blockedQuestions: Set<sessionID>`.
- `descendantBlockers(sessionId)` — walks each blocked session's ancestor
  chain (`parentOf`, depth-capped, cycle-guarded) and returns the blockers
  descending from `sessionId`: `{ asks: [...], questionSessions: [...] }`.

**Event fan-out (`handleServerEvent`)**

- For `permission.asked|replied` and `form.created|replied|cancelled`, after
  the direct per-session dispatch, the child's ancestor chain is resolved
  async and the event is re-dispatched to each ancestor's session listeners
  unchanged. A view therefore receives a foreign-`sessionID` event only via
  this path — no extra marker field needed.

**View (`SessionChatView`)**

- `descendantAsks[]` + `descendantQuestionIds` mirror the child blockers;
  `permission.asked` with a foreign `sessionID` appends (deduped by id),
  `permission.replied` removes by `requestID`, form events add/remove the
  child id.
- A second banner slot under the own-approval banner renders the head
  descendant ask (`Subagent needs approval — action (1 of N)` + resources +
  Reject / Always allow / Allow + Open subsession) and, per questioning
  child, a row (`Subagent needs answer` + Open). Replies post to
  `replyPermission(childSessionID, requestID, decision)`.
- `refreshPendingDescendants()` runs beside `refreshPendingPermission()` on
  load/reconcile; the badge and composer hint treat descendant blockers like
  own ones (`waiting` / `question`).

**Dashboard (`groupSubsessions`)**

- After deriving `subsessionsActive`: any direct child state `waiting` →
  parent `waiting` / "Subagent needs approval"; else any child `question` →
  parent `question` / "Subagent needs answer"; else the existing
  `delegating` derivation. Derived from `rawState` each pass (idempotent
  re-render). Deeper chains (grandchildren) re-state their own parent row;
  top-level propagation beyond direct children is a non-goal here — the
  chat-view banners cover full-depth chains via `ancestorChain`.

## Non-goals

- Inlining the child's question form UI into the parent (open-to-answer only).
- Streaming child message deltas into the parent transcript (TUI-style
  inline subagent rendering) — a much larger surface; the banners cover the
  blocked-on-human case.

## Testing

- `node --check` + dashboard smoke green.
- Live harness against the running server: create parent + child sessions
  (`parentID`), park asks on the child via the external
  `POST /api/session/:child/permission`, then verify (a) child list holds
  the ask, (b) `descendantBlockers(parent)` returns it, (c) the view logic
  renders/advances/clears the banner, (d) ancestor event dispatch reaches a
  parent listener. Cleanup: reply `reject`, delete both sessions.
