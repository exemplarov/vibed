# 008 — Block Authoring UX

Status: implemented (v0.18.0)
Date: 2026-10-07
Depends on: spec/002-implementation-plan.md (SessionsDashboard, toolbar),
spec/007-snippet-config.md (session-config keys)

## Goal

The #1 friction: recalling the block syntax for a new entry meant a trip to
the docs or copy-paste from a previous project. Kill it with the standard
Obsidian-native (non-AI) authoring affordances — no new DSL concepts, no
external plugins. Explicitly out of scope for this version: agent-side
leveraging (skills/commands bootstrapped from snippet config) — deferred.

## Design decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Insert UX | Command palette → modal form → insert at cursor | The Excalidraw/Kanbian idiom: users never need the DSL; the modal composes it. Fields cover the common keys; an *Extra config lines* textarea is the escape hatch for everything else (verbatim `key: value` lines) instead of form-enumerating the whole DSL. |
| Live preview | `<pre>` in the modal, recomputed on every keystroke | The preview *is* the syntax lesson — watching `layout: table` appear when the dropdown changes teaches the key. |
| Autocomplete | `registerEditorSuggest` scoped to ```vibed fences | Same mechanism as core frontmatter completion. Keys (with one-line docs), `connector:` names from settings, `layout:` values, `- ` items under `dirs:` from the named connector's configured directories. Values are live data, not static strings. |
| Fence detection | Nearest fence line above the cursor must be a ```vibed opener; cursor not on the fence line itself | Cheap upward scan, correct for well-formed fences; malformed fences simply don't suggest. |
| Copy-as-block | Toolbar icon button on every non-widget dashboard | The round-trip direction: filter interactively → copy the block (options + `#` tags) → paste anywhere. Criteria the DSL can't express (`is:`, `dir:`, `model:`, free text) ride along as a `# filter: …` comment — the parser skips `#` lines, so the paste still renders while documenting the dialed-in state. |
| Agent reference | Embedded in `main.js` (`AGENT_REFERENCE_MD`), written by command | Vaults stop hand-maintaining cheatsheets: *Save AI agent reference (AGENTS.md)* → folder picker (root default) → writes/updates the section between `<!-- vibed:begin/end -->` markers. Non-destructive: content outside markers is never touched; re-runs replace the managed section only. Version-stamped from the manifest at write time. |
| Block composition | One pure function, `composeVibedBlock(config)` | Shared by insert modal and copy-as-block; emits only keys with content (blocks stay minimal), lists as `key:` + `- item`; smoke-tested round-trip through `parseBlockConfig`. |
| Repo docs | `AGENTS.md` at repo root | Dev conventions + the DSL quick reference for agents working on the plugin; notes the three-places-one-truth rule (README tables, `AGENT_REFERENCE_MD`, quick reference). |

## Mechanism

```
command palette ─▶ VibedInsertModal ──▶ composeVibedBlock() ──▶ editor.replaceRange()
typing in fence ─▶ VibedBlockSuggest.onTrigger()  (analyzeVibedLine + fence scan)
                        └▶ getSuggestions(): VIBED_BLOCK_KEYS | registry connectors |
                           layout values | connector.config.directories
toolbar copy ───▶ SessionsDashboard.copyAsBlock() ─▶ composeVibedBlock(options+filter)
                                                        └▶ clipboard
AGENTS.md cmd ──▶ AgentReferenceFolderModal ─▶ plugin.saveAgentReference(folder)
                        └▶ applyAgentReference(existing, section)  (marker merge)
```

## Notes

- `selectSuggestion` replaces exactly the analyzed range (`start..end`), so
  partial words like `connector: cl⟶claude` complete in place; key inserts
  end with `": "` so typing flows straight into the value.
- The insert modal's *Session IDs* field intentionally maps to the
  pinned-widget mode (`sessions:` only → no toolbar); filling both dirs and
  sessions is allowed and emits both keys.
- The dedicated view's dashboard (`showSettings`) copies without its
  internal `title` ("OpenCode Sessions") — that title is chrome, not config.
- Smoke coverage: `composeVibedBlock` (order, dedup, minimal output,
  parse round-trip), `analyzeVibedLine` (key/value/list/mid-word),
  `applyAgentReference` (fresh/append/replace, idempotence),
  `normalizeTagList`.
