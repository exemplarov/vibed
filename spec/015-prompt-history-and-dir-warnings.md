# spec/015 — Missing-directory warnings and prompt history

Status: implemented (v0.23.0)

## Problem

Two ways a prompt (or a whole dashboard) can silently vanish:

1. **Invisible dirs.** A dashboard configured with `dirs:` pointing at a
   directory that doesn't exist on this machine (typo, not cloned yet,
   wrong machine) renders an empty list with no hint why. The widget has
   no way to say "the directory itself is the problem".
2. **Lost prompts.** Sending to a session in a non-existent directory —
   typically a draft whose working directory is gone — fails server-side
   and the prompt disappears with it. `send()` restored the composer on
   failure, but the draft path (`sendDraft`) cleared the input *before*
   `deliverText`, so a failed first message was unrecoverable: not in the
   composer, never on the server.

## Design

### A. Missing-dir warnings on dashboards (local mode only)

`directoryCapabilities()` gains a `localDirs` flag: true when the driver
resolves configured dirs against this machine's filesystem (file-backed
connectors, OpenCode v1's local sqlite, OpenCode v2 with a usable local
database), false for the v2 API-only listing of a remote server (paths
there belong to another machine — existence here proves nothing).

`SessionsDashboard.computeNotices()` — after the existing `~`/subtree
checks — resolves each raw dir entry exactly like `resolveDirectories`
does (`~` expansion, `basedir` join, normalize, trailing `/*` stripped to
its base) and checks it with `fs.statSync(dir, { throwIfNoEntry: false })`.
Missing entries surface as one warning notice:

> Not found on this machine: "~/spaces/typo" — sessions in a missing
> directory stay invisible.

Read-only/file connectors keep the warning too: a configured dir that
doesn't exist locally can still be a filter over historical transcripts,
but the fact is worth surfacing (and new sessions can't start there).
Remote (API-only) connectors are exempt — the check is skipped entirely.

`sendDraft` gets the same check as a preflight: when the connector is
local-dirs-capable and the draft directory is missing, the send is
refused up front with a Notice — no failed round-trip, prompt untouched
in the composer.

### B. Prompt history (composer)

The TUI recalls prompts with ↑/↓; the GUI gets that plus a browsable,
filterable popup.

**Sources, merged newest-first, deduplicated by exact text:**

- **In-window log** — every send *attempt* is recorded before delivery,
  so failed prompts (the warning case above, offline sends, refused
  drafts) land in history even though the server never saw them.
- **Server transcript** — user messages already loaded in the view (the
  listing the chat renders is the standard source; no extra endpoint).
  Pure merge helper `mergePromptHistory(local, transcript, limit)` keeps
  this testable outside Obsidian.

**UI:**

- A clock button in the composer actions (also `Ctrl/Cmd+↑`) opens a
  popup anchored above the composer (same anchor as the slash-command
  menu) with its own filter field: type to filter, `↑`/`↓` to move,
  `Enter` to insert, `Esc` to close. Rows preview the first line and
  mark multi-line prompts; clicking inserts (mousedown keeps focus).
- `↑` in the textarea starts TUI-style recall when the caret sits at the
  very start (or the input is empty); `↓` mirrors it from the end.
  Cycling past the newest restores the pre-recall draft; any manual edit
  ends recall. The slash-command menu keeps precedence while open.

**Failure handling:**

- `sendDraft` is split in two phases: create (failure keeps the prompt
  in the composer — it was never cleared) and deliver (failure restores
  the prompt to the composer).
- Restoration is guarded: if the user typed something new while the
  request was in flight, the composer is left alone — the failed prompt
  is still in history (Notice says so).

## Testing

- `scripts/dashboard-smoke.js`: local dashboards warn for missing dirs
  and stay quiet for existing ones; remote (API-only) drivers never run
  the check; `mergePromptHistory` dedup/order/limit unit checks.
- Manual: draft into a deleted directory (preflight Notice, prompt
  kept); kill the server mid-send (restored prompt); popup filter,
  keyboard recall cycle, draft restore.
