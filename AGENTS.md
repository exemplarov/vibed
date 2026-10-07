# Vibed — Agent Context

Obsidian plugin (community directory: `vibed`). Browses agent-session
histories inside Obsidian — dashboards embedded in notes via ```vibed code
blocks, a dedicated view, live streaming + chat for OpenCode v2, read-only
transcripts for OpenCode v1 / Claude Code / Codex / Cursor.

## Development model

- **Single hand-written file.** `main.js` is committed ES2022 — no build
  step, no bundler, no TypeScript. Don't introduce one.
- **Check before you commit:** `node --check main.js` (syntax) and
  `node scripts/dashboard-smoke.js` (dashboard mount/load/render against a
  stubbed DOM + pure-function checks). Both must pass.
- Desktop-only by design (`isDesktopOnly: true`): the plugin spawns
  `sqlite3`/`zstd` helpers and talks to local servers.
- Design docs are specs: `spec/001…009` (connector architecture,
  implementation plan, session notes, tags, find-in-chat, header menu,
  snippet config, authoring UX, chat environment/commands). New features get
  a numbered spec **before** shipping; status line says
  `implemented (vX.Y.Z)` when done.
- Session reports go to `reports/YYYY-MM-DD_vibed_<topic>.md`.

## Code map (main.js, top to bottom)

| Section | What lives there |
| --- | --- |
| helpers | clipboard, shell spawn, date/token formatting, `parseBlockConfig`, block authoring (`composeVibedBlock`, `analyzeVibedLine`, `VIBED_BLOCK_KEYS`, agent reference) |
| filter query | `parseFilterQuery` / `composeFilterQuery` — the dashboard query language (`#tag`, `is:`, `dir:`, `model:`, text) |
| snippet config | `extractSnippetSessionConfig`, root-state diff/merge helpers (`spec/007`) |
| connectors | per-kind drivers (OpenCode v2/v1, Claude, Codex, Cursor) + `ConnectorRegistry` |
| session notes | `SessionNotes` — vault files attached by `session:` frontmatter, Obsidian-semantics tags |
| dashboard | `SessionsDashboard` (shared by view + embedded blocks), `SessionsDashboardChild` |
| chat view | `SessionChatView`, `NewSessionView`, find-in-chat, approvals/questions, jump-to-latest, slash commands, `SessionEnvironmentModal` |
| settings tab | connector cards |
| authoring UI | `VibedBlockSuggest` (EditorSuggest), `VibedInsertModal`, `AgentReferenceFolderModal` |
| plugin | command/view/protocol registration, listing/routing, `globalThis.vibed` API (version 4) |

## Release checklist

1. Bump `manifest.json` **and** the README version badge together.
2. If the block DSL changed: update the README option tables **and** the
   `AGENT_REFERENCE_MD` constant in `main.js` **and** the quick reference
   below — three places, one truth.
3. `node --check main.js` + smoke test green.
4. Commit message format: `~/spaces/loomp-os/wiki/commit-convention.md`
   (`<area>: <description>`).
5. **Publish** — the Obsidian store tracks GitHub Releases, not commits:
   `git push origin main`, then tag the release commit with the exact
   manifest version (`git tag X.Y.Z && git push origin X.Y.Z`). The tag push
   triggers `.github/workflows/release.yml`, which cuts the GitHub release
   with `main.js`/`manifest.json`/`styles.css` as assets. Check `gh release
   list` afterwards — the new version must be **Latest**, and the store
   picks it up within ~an hour. An unpushed/unpublished commit is invisible
   to users (this is how 0.18.0 briefly vanished: committed, never tagged).

## vibed block quick reference

Body: simple `key: value` lines (lists as indented `- item`) or one JSON
object; `#` lines are comments.

- **Dashboard options:** `connector` (name; omit = default), `dirs` (list;
  `~` expands locally, trailing `/*` = subtree), `basedir`, `sessions` (id
  list → clean pinned widget), `tags` (list; sessions whose note carries
  all), `layout` (`cards`|`table`), `pageSize`, `title`.
- **Session config, ephemeral:** `model` (`provider/model[#variant]`),
  `agent`, `permissions`, `environment` — prefill/create-time only.
- **Session config, root state:** `skills` (sources or `{id, install}`),
  `mcp`, `commands`, `agents`, `providers`, `references`, `default_agent` —
  desired directory config; diffed at session start, installed on consent.
- **Authoring UX (v0.18+):** command *Insert session dashboard block*
  (form + live preview), autocomplete inside ```vibed fences (keys, connector
  names, layout values, configured dirs), *Copy as vibed block* on every
  dashboard toolbar, and *Save AI agent reference (AGENTS.md)* which writes
  the embedded reference into any vault folder between
  `<!-- vibed:begin -->` / `<!-- vibed:end -->` markers.
