# 010 — Pending inbox: queue visibility, cancel, steer/queue control

Status: implemented (v0.20.0)

OpenCode v2 admits every prompt durably into a per-session **inbox** before
the agent loop picks it up (`POST /api/session/:id/prompt` returns the inbox
item; its `id` becomes the message id once delivered). Until promotion the
item is *sent but unprocessed* — it survives server restarts, can be
delivered mid-turn (**steer**, the default: injected at the next step
boundary) or only at an idle boundary (**queue**, in admission order), and
can be cancelled server-side. This spec gives the chat view full visibility
and control over that window, matching the TUI's queued-prompt handling.

## API surface used (OpenCode v2)

| Call | Purpose |
| --- | --- |
| `POST /api/session/:id/prompt` `{text, delivery?}` | send; response `data` is the inbox item (`{id, type, payload, delivery, time}`) |
| `GET /api/session/:id/inbox` | list pending items (user, synthetic, compaction, move), admission order |
| `DELETE /api/session/:id/inbox/:inboxID` | cancel an undelivered item (idempotent 204; delivered items are a no-op) |
| `PATCH /api/session/:id/inbox/:inboxID` `{delivery}` | flip `steer ⇄ queue`; steering wakes execution |

Events (all durable, session-routed): `session.inbox.enqueued`
(`{inboxID, item}`), `session.inbox.delivered` / `session.inbox.cancelled`
(`{inboxID}` — the id stays the message id on delivery),
`session.inbox.delivery.changed` (`{inboxID, delivery}`).

Older v2 builds without the inbox endpoints: the first `GET /inbox` 404/405
flips `inboxSupported` to `false`, all pending chrome is stripped, and the
view falls back to the previous rendering (enqueued user messages appear as
plain bubbles; no actions). Events still feed an internal map so a later
capability change re-renders correctly.

## Sent vs. not sent (highlighting)

- **Delivered** (real message): the normal solid user bubble — unchanged.
- **Sent but unprocessed**: the same bubble with a dashed border, muted
  tint, a pulsing dot and a status line — `Steering — picks up at the next
  step boundary` (steer) or `Queued — runs when the session is idle`
  (queue). Non-user items (`compaction`, `move`, `synthetic`, e.g. queued
  by `/compact`) render as cancellable pending note rows.
- **Never sent**: unchanged behavior — a failed `POST /prompt` restores the
  text into the composer with a Notice; nothing is rendered.

## Pending items stay at the bottom

Pending bubbles are appended after the newest delivered message (the
transcript is bottom-anchored), so unprocessed work always sits directly
above the composer — mirroring the TUI's queued-prompt dock. Delivery does
not move the bubble (the id is stable); a full refresh re-orders
chronologically once the item is a real message.

## Controls on a pending row

- **Cancel** — `DELETE` the inbox item; the `cancelled` event removes the
  bubble.
- **Recall** (user prompts) — cancel and put the text back into the
  composer (appended on a new line if the composer has text), then focus it
  (the TUI's `ctrl+u`).
- **Move to queue / Steer now** — `PATCH` the delivery mode; the
  `delivery.changed` event (plus an optimistic local flip) updates the row.
  Steer also wakes a sleeping session server-side.

## Send-side control

- **Enter** — steer (server default; body omits `delivery`).
- **Ctrl/Cmd+Enter** — send with `delivery: "queue"` (the TUI's
  `<leader>return`). Slash commands ignore queueing (the command endpoint
  does not take a delivery parameter).
- **Queue button** — appears between Stop and Send *only while a turn is
  running* (the one state where queue differs from steer — an idle session
  picks either up immediately, so the button would be noise). Labeled
  "Queue" + a symbol-only keys hint (⌘↵ on Apple platforms, ⌃↵ elsewhere)
  that doubles as the shortcut reminder; hidden offline and in drafts,
  disabled with an empty composer.
- Composer placeholder and the hint line document both. The hint line also
  surfaces the pending count (`2 prompts pending — …`) while items wait.

## Hydration & races

- `loadInitial` and `reconcileNow` rehydrate from `GET /inbox` alongside
  the message listing. An id that left the server inbox **and** appears in
  the message listing was delivered (chrome stripped); if it is absent from
  both it was cancelled (bubble removed). This heals missed SSE events
  after reconnects.
- The prompt response seeds the map immediately (its `data.delivery`
  distinguishes an inbox item from a legacy message-shaped response), so
  chrome renders even if the `enqueued` event races the response.
- `upsertMessage` diffs payloads only, so every inbox-state transition
  re-renders the touched record explicitly.

## Non-goals

- No optimistic pre-ACK bubble while the `POST /prompt` is in flight (the
  local-server round trip is fast; failure already restores the text).
- No separate queued-prompt dock element — the bottom-pinned pending rows
  plus the hint-line count cover it.
- v1 / file / read-only connectors: untouched (`chat` capability gates all
  of the above).
