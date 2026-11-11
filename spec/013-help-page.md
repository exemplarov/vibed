# spec/013 — In-app help page ("?" button)

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
  session" button and after Refresh. `help-circle` icon, `title: "How to
  use vibed"`.
- Opens the help page via `plugin.activateHelpView()`.

### Help page

- New `VibedHelpView extends ItemView`, `VIEW_TYPE_HELP =
  "vibed-help-view"`, icon `help-circle`, display text "Vibed help".
- Renders one markdown constant (`VIBED_HELP_MD`) with
  `MarkdownRenderer.render` on open.
- `activateHelpView()` mirrors `activateView()`: reuse the existing help
  leaf, else open in the right sidebar, then reveal.
- Command: "Open vibed help" (id `open-help`).

### Content (`VIBED_HELP_MD`)

User-facing guide, progressive complexity:

1. What vibed is + the sessions view / ribbon.
2. **Widgets quick-start** (the emphasis): a ```vibed fence in any note;
   examples as ```yaml fences (NOT ```vibed — the registered processor
   would mount live dashboards inside the help page):
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
inside the page.

## Out of scope

- Contextual help per widget, tooltips tour, i18n.
- README/`AGENT_REFERENCE_MD` changes (no DSL change → three-places rule
  not triggered; README gets one feature bullet).
