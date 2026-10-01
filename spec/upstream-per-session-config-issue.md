# Upstream issue draft — per-session config override

Status: draft (not filed yet)
Date: 2026-10-01
Context: vibed's snippet session config (spec/007) needs files only because
the v2 API has no per-session configuration; this ask would make the whole
install machinery unnecessary for the common case.

Target repo: anomalyco/opencode (API is experimental; location-scoped
patterns already exist).

---

## Title

`POST /api/session`: accept a per-session config override

## Body

### Context

OpenCode v2 configuration is location-scoped and file-based: `opencode.json(c)`
discovered from the global config down through every ancestor of the
location directory. That is the right model for human-maintained project
config, but clients that assemble sessions programmatically (custom UIs,
eval harnesses, the Obsidian session browser) currently cannot give one
session its own skills, commands, agents, MCP servers, or provider entries
without writing files into the location's tree — mutating project config
that outlives the session and may live in a git repository the client has no
business editing.

Concretely, vibed (Obsidian plugin) lets a note-embedded block define the
config for sessions it starts. Today that requires writing
`.opencode/opencode.json` into the user's project after an explicit consent
dialogue, plus a learned manifest to know which skill installer commands
already ran. All of that exists only because there is no way to hand the
server a config for one session.

### Request

Extend `POST /api/session` with an optional config document:

```jsonc
POST /api/session
{
  "location": { "directory": "/proj" },
  "model": "anthropic/claude-sonnet-4-5",
  "agent": "build",
  "config": {
    "mcp": { "servers": { "playwright": { "type": "local", "command": ["bunx", "@playwright/mcp"] } } },
    "skills": ["https://example.com/.well-known/skills/"],
    "commands": { "review": { "template": "Review the current diff." } }
  }
}
```

Semantics:

- deep-merged over the location's discovered config for **that session's
  lifetime only** (nothing persisted, nothing written to disk);
- inherited by the session's subagent children, like other session state;
- `permissions` already works this way at creation — this generalizes the
  same idea to the rest of the config surface.

### Why this shape

- Precedent exists in the API surface: `permissions` is already per-session
  at creation, and `PUT /api/experimental/mcp/{server}` is already
  location-scoped. Session-scoped config completes the pattern.
- It enables ephemeral, self-contained session templates for any client —
  task runners, evals, note-driven dashboards — without file side effects.
- It composes with existing config: an override never has to restate the
  whole document, just the deltas it cares about.

### Secondary ask

`PATCH /api/experimental/config` currently patches only `shell`. A broader
variant, ideally location-scoped (`?location[directory]=…` like the MCP
routes), would let clients manage project config through the API instead of
file writes — which is also the only viable path for clients connected to
remote servers with no filesystem access to the project.

### Alternatives considered

- Clients write config files (status quo): works locally, pollutes repos,
  impossible for remote clients, needs consent UX around every write.
- `OPENCODE_CONFIG_CONTENT`-style env overrides on a per-session spawned
  server: heavy (a server per session) and fights the shared-service model.
