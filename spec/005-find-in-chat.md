# 005 — Find in Chat

Status: implemented (v0.12.0)
Date: 2026-09-10
Depends on: spec/002-implementation-plan.md (SessionChatView, chat DOM)

## Goal

Browser-standard in-page search (`Ctrl+F` / `Cmd+F`) for the session
chat view: type, see every match, hop through them, close. The contract
is "the keys my hands already know" — no new UI language to learn.

## Design decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Scope | The rendered transcript only (`.oc-msg` in the chat column) | The chat log is what the user reads; header, banners, composer, notes panel, and the load-older button are chrome, not content. |
| Visibility rule | Text nodes inside a **closed `<details>`** are skipped; their `<summary>` labels stay searchable | Collapsed Thinking / tool Input / Output blocks are exactly the "collapsed nodes" the user does not see. The chat is built from `<details>` elements, so the check is one ancestor walk per node. |
| Loaded-ness rule | Only loaded messages are searched (the chat pages history in) | Same "what you see is what you search" contract; when older history exists, zero matches report as `0 in loaded` instead of a flat lie. |
| Highlighting | CSS Custom Highlight API (`::highlight(vibed-find)`) with a `.oc-find-target` outline fallback | Painting via Ranges never touches the DOM — markdown re-renders and streaming `setText` calls cannot corrupt highlights. Chromium ≥105 (Obsidian ships newer); the fallback keeps counting/navigation alive anywhere else. |
| Matching | Plain substring per text node, case-insensitive by default, `Aa` toggle | Matches browser expectations. Cross-element matches don't count (standard limitation of DOM highlighting); markdown splits text into inline nodes, so a phrase broken by emphasis won't match. |
| Ordering | Visual order: oldest → newest (the chat is column-reverse, so DOM order is newest-first and gets reversed) | Enter means "next" = further down the conversation, like a page. |
| Position anchoring | Every match carries (visual msg index, node index, char offset); re-queries select the first match at-or-after the previous selection, wrapping to the top | Typing/refining a query keeps you where you were (Chrome behavior); if the old spot no longer matches, wrap to the first. |
| Liveness | While open, a `MutationObserver` (childList/subtree/characterData) + capture-phase `toggle` listener re-run the search (150 ms debounce) | Streaming deltas, reconcile re-renders, load-older pages, and manual `<details>` toggles all change the result set. Refreshes preserve the current match and **never move the scroll** — only user-driven actions scroll. |
| Keys | Open: `Ctrl+F` / `Cmd+F` (Alt/Shift combos untouched). Next/prev: `Enter`/`Shift+Enter`, `F3`/`Shift+F3`, `Cmd|Ctrl+G` / `Cmd|Ctrl+Shift+G`. Close: `Esc` | The union of what Chrome/Firefox do on their platforms; handlers live on `contentEl` in the capture phase so they win whenever the session tab owns focus (an actual markdown editor in another pane keeps Obsidian's own find). |
| Scrolling | Manual rect math: inner scrollables first (tool `<pre>` are height-capped), then the transcript centered on the match | `scrollIntoView` in a `column-reverse` flex container is unreliable across engines; pixel deltas map 1:1 to visual movement, so `scrollTop += delta` is exact — including negative scrollTop territory at the visual top. |
| Lifecycle | Highlights cleared and observer disconnected on close and on view `onClose`; `Esc` restores focus to the previously focused element | `CSS.highlights` is document-scoped — a closed tab must not leak registrations. |

## Mechanism

```
Ctrl/Cmd+F ──▶ openFind()          bar unhidden, input focused+selected,
                                   MutationObserver attached, runFind()
type ────────▶ runFind(preserve)   collect → anchor → highlight → count
Enter/F3/G ──▶ stepFind(±1)        index = (i ± 1 + n) % n, repaint current
DOM change ──▶ scheduleFindRefresh()  debounce 150 ms → runFind(no scroll)
Esc/close ───▶ closeFind()         observer off, registry cleared,
                                   focus restored, bar hidden
```

Match collection walks `.oc-msg` elements newest→oldest, reverses for
visual order, then a `TreeWalker` per message over text nodes that are
(a) inside that message and (b) not under a closed `<details>`.
