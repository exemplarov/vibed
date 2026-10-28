# vibed — approval banner not rendering for a parked permission batch (ses_e7f02c3f7ffeaRgeM74A4man6n)

Date: 2026-10-28 · Status: fixed in main.js; superseded by spec/011 for the
subagent case (v0.21.0, same day — see below)

## Follow-up (v0.21.0): subagent asks on the parent thread

After reload Roman identified the case the 0.20.1 fix did NOT cover: asks
parked on **subagent** sessions surfaced only in the child chat (the TUI
shows them on the parent thread). Shipped as spec/011: ancestor event
fan-out, a subagent banner on the parent (reply against the child + open
jump), descendant rehydration, driver-level waiting/question healing for
active sessions, and dashboard parent cards re-stated when a child is
blocked. Verified live end-to-end (parent/child pair via API, asks parked
with the external permission.create endpoint, wire events captured).


## Report

Roman: session `ses_e7f02c3f7ffeaRgeM74A4man6n` waits on approvals; the TUI
renders them, the plugin doesn't. Asked whether a wire format went missing or
OpenCode changed. Session deliberately left pending for analysis (3 asks on
`external_directory` writes under `~/spaces/kangram/loomps/*/.loomp/`).

## Root cause — vibed-side, not an OpenCode format change

- The model's parallel tool batch parked **one permission ask per `write`
  call** (4–5 asks at 16:39 AEDT; the first was approved at 17:51 — elsewhere,
  presumably the TUI; 3 remain pending on the server right now).
- vibed tracked exactly **one** pending permission: `refreshPendingPermission`
  read `data[0]` of `GET /api/session/:id/permission`, and
  `permission.asked` events **replaced** the single slot.
- When the first ask was replied, `permission.replied` cleared the banner —
  and nothing ever brought the remaining asks back:
  - `permission.replied` triggered no reconcile/refetch;
  - a blocked session emits no further session events, so no
    `reconcileNow()` ever ran;
  - `refreshIfStale()` early-returns while the view is `busy` — and the view
    stays busy (the session is mid-execution from the driver's view).
- The TUI works because it maintains the **full** permission list and
  re-lists on hydrate/reconnect. Upstream's own app code says it plainly:
  *"The event stream does not replay requests asked while this client was
  disconnected"* — hence their sweep of the (new) global
  `/api/permission/request` endpoint.

Wire format verified unchanged at server v2.1.4 (schema tag `v2.1.4`,
`anomalyco/opencode`): `permission.asked` still carries
`id/sessionID/action/resources/save/source/message`; the per-session
permission endpoint returns the same shape. (Durable DB events carry `.1`
suffixes — persistence versioning only, not the SSE wire.)

Secondary blind spot: the dashboard "Needs approval" badge was set **only**
by the live `permission.asked` event. A blocked session reports
`type: "running"` in `/api/session/active`, so after any missed event
(plugin closed / stream gap at ask time) the badge read "running" forever.

## Fix (main.js)

1. **Batch tracking** — the chat view now keeps `pendingPermissions[]`;
   live asks append (deduped by id), the banner renders the head with a
   `(1 of N)` count.
2. **Advance on replies** — `permission.replied` removes that id; the next
   ask renders immediately; a server re-sync follows every reply (covers
   asks parked while this client was disconnected).
3. **Server-truth refresh** — `refreshPendingPermission` replaces the
   tracked set wholesale (id-diffed, so no needless DOM churn), healing
   replies/asks missed in any SSE gap.
4. **Dashboard healing** — `syncActiveSessions` (every stream connect /
   reconnect) now probes each active session's permission list and
   re-derives `waiting` (`syncBlockedPermissions`), mirroring TUI hydration.

## Verification

- `node --check main.js` + `node scripts/dashboard-smoke.js` — green.
- Live harness against the running server (v2.1.4): rehydrate loads all 3
  real asks; duplicate ask is a no-op; replying the head advances to the
  next (`1 of 2`); draining empties the banner; `syncBlockedPermissions`
  flips the session's live state to `waiting`. (Harness kept at
  `$TMPDIR/opencode/vibed-perm-test/verify-fix.js`; scratch session deleted.)
- The 3 real asks were **not** replied — kept pending per Roman's request;
  opening that chat in the rebuilt plugin should now show
  `Needs approval — external directory (1 of 3)`.

## Notes for release

- Behavior fix, no block-DSL/settings change → no README/manifest bump
  strictly needed; ship as 0.20.1 when convenient.
- Possible follow-up (not done): use the global
  `/api/permission/request?location=…` sweep like upstream, instead of
  per-session GETs (N+1 on reconnect; fine for local single-user servers).
