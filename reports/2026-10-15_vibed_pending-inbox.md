# 2026-10-15 — vibed: pending inbox (cancel/recall/steer-queue UI)

## Shipped

OpenCode v2 admits every prompt into a durable per-session **inbox** before
the agent loop picks it up (the inbox item's id *is* the future message id).
v0.20.0 gives the chat view full visibility and control over that window
(spec/010):

- **Sent-state highlighting** — delivered prompts render as the normal solid
  bubble; sent-but-unprocessed ones get a dashed, muted bubble with a pulsing
  dot + status ("Sent — picks up at the next step boundary" / "Queued — runs
  when the session is idle"). Queued compaction/move/synthetic items render
  as cancellable pending note rows.
- **Pending pinned at the transcript bottom**, above the composer (TUI dock
  parity); delivery keeps the bubble in place (stable id).
- **Controls per pending row** — Cancel (`DELETE /inbox/:id`), Recall
  (cancel + text back into the composer, the TUI's `ctrl+u`), and steer ⇄
  queue flip (`PATCH`), with optimistic local updates.
- **Send-side** — Enter steers (TUI parity, verified against
  `packages/tui/src/mini/footer.prompt.tsx`), `Ctrl/Cmd+Enter` queues, and a
  **Queue ⌘↵/⌃↵ button** appears between Stop and Send only while a turn
  runs (the one state where queue ≠ steer). Button group right-aligned:
  `[Stop][Queue][Send]`.
- **Hydration** — `loadInitial`/`reconcileNow` rehydrate from `GET /inbox`,
  using the message listing to tell delivered from cancelled (heals missed
  SSE events); servers without the inbox API fall back to legacy rendering.
- Client additions: `inboxList` / `inboxCancel` / `inboxUpdate`, `prompt(…,
delivery)`; helpers `normalizeInboxItem` / `inboxMessageFrom` (smoke-tested).

## Commits

- `df08b5b` chat: pending inbox — queue visibility, cancel/recall, steer-queue control (0.20.0)
- `0333e83` chat: Queue button beside Send while a turn runs, with symbol keys hint
- `3dce56c` chat: right-align composer button group (Stop · Queue · Send)

## Verification

Live-tested by Roman against the local OpenCode **v2.0.26** server, plus curl
probes against a scratch session:

- prompt response is the inbox item (`delivery` field) → pending chrome
- queue-on-send via button; cancel = 204 + `session.inbox.cancelled` event,
  idempotent on repeat DELETE
- full round trip: queue → pending bubble → idle-boundary promotion → same
  id appears in the message listing → bubble turns solid

## Remaining

- **Publish** (not done): `git push origin main` + `git tag 0.20.0 && git
  push origin 0.20.0` → release workflow → store pickup (~1h).
