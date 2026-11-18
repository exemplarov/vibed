# 2026-11-18 — vibed: missing-dir warnings + prompt history (spec/015)

## Report

Two UX gaps, both "silently invisible" failure modes:

1. A dashboard whose `dirs:` point at a directory that doesn't exist on
   this machine (typo, un-cloned repo, wrong machine) rendered an empty
   list with no explanation.
2. Sending to a session in a non-existent directory errored server-side
   and ate the prompt: `send()` restored the composer on failure, but the
   draft path (`sendDraft`) cleared the input *before* `deliverText`, and
   its single catch-all neither restored the text nor said what failed —
   the first message of a draft was unrecoverable.

## Changes (spec/015, `spec/015-prompt-history-and-dir-warnings.md`)

**Missing-dir warnings (local mode only)**

- `directoryCapabilities()` gains `localDirs`: true for file-backed
  connectors and OpenCode v2 with a usable local database, false for the
  v2 API-only listing of a remote server (its paths belong to another
  machine — a local stat proves nothing). Drivers without the flag
  inherit `home`.
- `SessionsDashboard.computeNotices()` resolves each raw dir entry like
  `resolveDirectories` does (`~` expansion, `basedir` join, `/*` stripped
  to its base) and `fs.statSync`s it; missing entries surface as one
  warning notice ("Not found on this machine: … — sessions in a missing
  directory stay invisible").
- `newSession` warns (doesn't block) when an exact dir is missing;
  `sendDraft` refuses up front on a missing draft directory for
  local-dirs connectors — no failed round-trip, prompt untouched.

**Prompt history**

- Pure merge helper `mergePromptHistory(local, transcript, limit)` —
  newest-first, dedup by exact text.
- `SessionChatView` records every send *attempt* before delivery
  (`rememberPrompt`), so failed prompts stay recallable even though the
  server never saw them; `promptHistoryEntries()` merges that log with
  the loaded transcript's user messages (the server's own record — no
  extra endpoint needed).
- GUI: a clock button in the composer actions (also `Ctrl/Cmd+↑`) opens
  a popup anchored above the composer with its own filter field
  (`↑`/`↓`/`Enter`/`Esc`); rows preview the first line, mark multi-line
  prompts, click or Enter inserts.
- TUI parity: plain `↑`/`↓` recall prompts when the caret sits at the
  textarea's start/end (or a recall is under way); cycling past the
  newest restores the pre-recall draft; any manual edit ends the recall;
  the slash-command menu keeps precedence while open.
- Failure handling: `sendDraft` is split into create/deliver phases — a
  failed create keeps the prompt in the composer (it was never cleared),
  a failed first delivery restores it. Restoration is guarded: if the
  user typed something new while the request was in flight, the composer
  is left alone and the Notice points at history instead.

**Docs/tests**: README features + `dirs` option row; smoke test extended
(remote never warns, local warns for missing / quiet for existing,
`mergePromptHistory` unit checks). `node --check` + smoke green.

## Status

Implemented, unreleased — ships with the next version bump (0.23.0).
Manual passes worth doing in Obsidian: draft into a deleted directory
(preflight Notice, prompt kept), popup filter + keyboard recall cycle,
and a remote connector dashboard with a bogus dir (must stay quiet).
