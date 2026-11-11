# spec/013 — In-app help ("?" button)

Status: in progress

## Problem

The UI is discoverable, but the vibed block DSL (YAML keys, list syntax,
JSON alternative) is not — users have to read the README to author a
widget. The plugin needs an in-app quick-start, emphasis on widgets,
ordered simple → complex.

## Design

### "?" button

- Icon-only toolbar button in `SessionsDashboard.mount()` (shared by the
  dedicated view and embedded blocks), placed **before** the "+ New
  session" button and after Refresh. `help-circle` icon.
- Opens a small **menu** (amendment v2 — no separate view): *Quick-start
  guide* (primary), then the authoring commands *Insert session dashboard
  block* and *Save AI agent reference (AGENTS.md)*.

### Quick-start guide

- Rendered from one markdown constant (`VIBED_HELP_MD`) inside a wide
  scrollable **modal** (`VibedHelpModal`) — deliberately NOT a workspace
  leaf: a help view would add a second vibed icon to the right sidebar,
  and the plugin keeps exactly one sidebar presence (the sessions view).
- Command "Open vibed help" (id `open-help`) opens the modal directly.
- A draft of this spec shipped a `VibedHelpView` leaf; reverted per user
  feedback before any release.

### Content (`VIBED_HELP_MD`)

User-facing guide, progressive complexity:

1. What vibed is + the sessions view / ribbon.
2. **Widgets quick-start** (the emphasis): a ```vibed fence in any note;
   examples as ```yaml fences (NOT ```vibed — the registered processor
   would mount live dashboards inside the guide):
   - minimal (zero keys)
   - `dirs` (most-used; `~` and `/*` subtrees)
   - `title`, `layout: table`, `pageSize`
   - `connector`
   - `sessions:` pinned widget
   - `tags`, `archived: true`, `basedir`
3. Session config keys — ephemeral (`model`, `agent`, `permissions`,
   `environment`) then root-state (`skills`, `mcp`, `commands`, `agents`,
   `providers`, `references`, `default_agent`), one line each + the
   consent-diff note.
4. JSON body alternative + `#` comments.
5. Filter box language: `#tag`, `is:state`, `dir:`, `model:`, phrases.
6. Authoring tools: insert command, fence autocomplete, copy-as-block.
7. Chat in one paragraph: approvals, questions, steer/queue, rename/
   archive menu.
8. Connectors + where to configure (Settings).

Every section leads with a copy-pasteable snippet. No live dashboards
inside the guide.

## Out of scope

- Contextual help per widget, tooltips tour, i18n.
- README/`AGENT_REFERENCE_MD` changes (no DSL change → three-places rule
  not triggered; README gets one feature bullet).
