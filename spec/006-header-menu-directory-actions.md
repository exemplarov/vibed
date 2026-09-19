# 006 — Header ⋮ Menu & Workspace-Directory Actions

Status: implemented (v0.13.0)
Date: 2026-09-19
Depends on: spec/002-implementation-plan.md (SessionChatView chat header,
NewSessionView picker)

## Goal

Tidy the chat header (three scattered actions → search + one ⋮ menu) and
add **working-directory operations** everywhere a workspace directory is
on screen: the session's own dir in the chat header, and every candidate
dir on the new-session picker. Operations: **copy path**, **open in the
system file manager**, **open in terminal**.

## Design decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Header layout | `<Find (icon)> <Notes (icon)> <⋮>` — Copy ID and Refresh move into the ⋮ menu | Copy ID and Refresh are rare, deliberate actions; search is the frequent one and stays one click. Notes stays a direct button (toggle state lives on it). |
| Menu widget | Obsidian's native `Menu` (`showAtMouseEvent`) | Native positioning/dismiss/a11y for free; the hand-rolled popover pattern (filter funnel) is reserved for the chip UI that needs custom DOM. |
| Directory section | Separator + a **disabled label item** showing the absolute path, then Copy path / Open in *Finder-Explorer-file manager* / Open in terminal | The label makes the target explicit (chat dir ≠ vault root); a disabled item is the standard menu-header idiom. |
| Section sharing | One builder, `appendDirectoryMenuItems(menu, dir, withSeparator)` | Identical section in both surfaces; the picker omits the leading separator because its menu contains nothing else. |
| Empty directory | Items render disabled, section stays visible | Session meta not loaded yet (or a connector without dirs) is a state, not an error; the menu shouldn't reshape while loading. |
| Drafts | Copy ID + Refresh disabled in the chat ⋮ (no id yet, refresh is a no-op); directory section live on `draftDirectory` | Same policy the old buttons had de facto (`refresh()` guards drafts); the dir actions are exactly what a fresh draft wants. |
| File manager | darwin `open <dir>` · win32 `explorer <dir>` · else `xdg-open <dir>` | Platform conventions. `explorer` errors are ignored: it exits 1 even on success and shows its own dialogs for real failures. |
| Terminal | darwin `open -a Terminal <dir>` · win32 `cmd.exe /c start "" cmd /K cd /d <dir>` · Linux `$TERMINAL`, else first of gnome-terminal / konsole / xfce4-terminal / kitty / alacritty / wezterm / x-terminal-emulator (each with its own cwd flag) | No cross-platform "open terminal" API exists; per-terminal cwd flags are the reliable route. Linux probe is $PATH stat per candidate — a handful of stats per click. |
| Spawning | `execFile` detached + `unref()`, failures → `Notice` | Same policy as sqlite3/zstd helpers: a lingering terminal window never pins the plugin; nothing runs unprompted — these commands fire only on menu click. |
| Busy feedback | Refresh-in-flight spins the ⋮ button itself (`.oc-more.oc-busy`) | The dedicated refresh button is gone; the spinner keeps the "something is reloading" signal for both manual and automatic refreshes. |
| Picker entry point | Kebab button on each directory card (`stopPropagation`) | The card body remains the pick action; the ⋮ is scoped to that card's directory, not the picker as a whole. |

## Mechanism

```
chat header ⋮ ─▶ showHeaderMenu()      Menu: Copy ID, Refresh,
                                        + appendDirectoryMenuItems(session dir)
picker card ⋮ ─▶ inline click handler   Menu: appendDirectoryMenuItems(dir,
                                        no separator); stopPropagation
Copy path ─────▶ copyTextToClipboard()  clipboard write + Notice
Open folder ───▶ openDirectoryInFileManager(dir)   open | explorer | xdg-open
Open terminal ─▶ openDirectoryInTerminal(dir)      Terminal | cmd | $TERMINAL |
                                        first Linux emulator on $PATH
```

Directory resolution in the chat: `this.session?.location?.directory ||
this.draftDirectory` — the same expression the composer uses, so drafts
and live sessions both target the right folder.

## Testing notes

- `node --check main.js` and `node scripts/dashboard-smoke.js` (dashboard
  mount/render paths unaffected — the smoke harness's `moreButton` is the
  dashboard's *Show more*, a different view).
- Manual: ⋮ in a live chat, a draft chat, and on picker cards (copy →
  paste; open → Finder/Explorer/xdg; terminal → new window cd'd to the
  dir). Missing dir (connector without one) → section disabled.
