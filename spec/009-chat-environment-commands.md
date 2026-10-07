# 009 — Chat environment popup, slash commands, jump-to-latest

Status: implemented (v0.19.0)

Three composer/transcript UI additions for the session chat view, closing the
gap with the OpenCode TUI's prompt experience. All three are OpenCode v2 only
(gated on capabilities); read-only connectors are unaffected.

## 1. Jump-to-latest (scroll-to-bottom) button

The transcript is a `column-reverse` scroller: `scrollTop === 0` is the
newest message (bottom), negative values mean the user scrolled up. A floating
button appears pinned above the composer's right corner whenever the user is
more than ~60 px away from the bottom.

- Click (or `End` while the transcript has focus) scrolls smoothly back to
  `scrollTop = 0`.
- While the user is scrolled away, **new** messages (new `oc-msg` records —
  user or assistant) increment an unread counter shown as a badge on the
  button ("3", "9+"). Deltas on existing messages don't count. The badge
  clears when the user returns to the bottom (scroll or click).
- Sending a message always snaps to the bottom (instant, not smooth) — the
  composer is fixed, so the reply must be visible immediately.
- The button lives in `.oc-main` (already `position: relative`), next to the
  find bar, so it overlays the transcript without participating in the
  column-reverse flow.
- `loadOlder`'s scroll-preservation math is untouched; visibility is updated
  in the same `scroll` listener that drives infinite scroll upward.

## 2. Session environment popup

A header button (plug icon, between Find and Notes) opens a modal showing
what the server exposes **for this session's directory** — the same picture
the TUI sidebar gives:

- **MCP servers** from `GET /api/mcp?location[directory]=…` — name + colored
  status (connected / disabled / failed / needs auth / needs client ID, error
  text inline for failures). Response shapes differ across server
  generations (`{data: [...]}` array vs a name→status record, possibly
  unwrapped), so a normalizer accepts all of them.
- **Commands** from `GET /api/command?location[directory]=…` — name +
  description, with a hint that they run by typing `/name` in the composer.
- **Skills** from `GET /api/skill?location[directory]=…` — id + description.
- Per-server **Connect / Disconnect** actions via
  `POST /api/experimental/mcp/:name/connect|disconnect`, falling back to the
  newer `/api/mcp/:name/…` paths on 404. A connect reply carrying an
  `authorizationUrl` (OAuth servers) renders a link instead of pretending it
  connected. After any action the list re-fetches.
- A Refresh button re-runs all three queries. Shown only for v2 drivers with
  chat capability (the button hides otherwise, like the model selector).

## 3. Slash commands ("/" support)

The composer accepts TUI-style command input:

- **Autocomplete menu** — typing a leading `/` opens a filterable list above
  the composer (command name + description, substring match). `↑`/`↓` move
  the highlight, `Tab` or `Enter` completes `/name ` (Enter sends directly
  when the typed word is already an exact command name), `Esc` closes,
  clicking a row completes. The menu hides as soon as the slash word ends
  (space/newline) or the `/` is no longer first.
- **Send routing** — on send, the first token decides: if it is `/name` and
  `name` is a loaded command, the text goes to
  `POST /api/session/:id/command` (name + remainder as arguments, multi-line
  remainder preserved like the TUI); anything else — including unknown
  `/names` — is sent as a normal prompt, exactly the TUI's rule. Drafts
  create the session first, then route the same way.
- **Payload compat** — released v2 servers take `{name, text}`; newer builds
  renamed it to `{command, arguments}`. The client tries the v1 shape, falls
  back once on a 4xx (validation only — 4xx means nothing executed), and
  caches the working shape per connector.
- The v1 endpoint replies `204` (no body): no synthetic user bubble is
  inserted then; the real one arrives via `session.inbox.enqueued` SSE (or
  the scheduled reconcile as a fallback). When a body is returned its
  `data.id` keys the upsert so SSE dedupes.
- Commands load per directory alongside models/agents (session directory or
  draft directory).

## Pure helpers (smoke-tested)

`composerCommandQuery(value)` (is the composer typing a slash word?),
`filterCommands(list, query)`, `parseComposerCommand(text)` (name + args
split), `normalizeMcpList(response)`, `normalizeCommandList(response)`.

## Non-goals

- No `@file` / `@agent` mention autocomplete (TUI has it; parts API is a
  separate feature).
- No MCP add/remove or OAuth completion inside the popup (link out only).
- No command palette over the whole plugin.
