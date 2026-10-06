#!/usr/bin/env node
// Dashboard smoke test: runs SessionsDashboard's mount/load/render paths
// against a stubbed DOM + driver, outside Obsidian. Catches "infinite
// Loading…" class regressions (a render() throw aborts mount and freezes
// the status line — exactly what v0.11.0 shipped by accident).
//
// Usage: node scripts/dashboard-smoke.js   (exit 0 = pass)

const fs = require("fs");
const path = require("path");

const mainPath = path.join(__dirname, "..", "main.js");
let src = fs.readFileSync(mainPath, "utf8");
const obsidianLine = src.split("\n").find((l) => l.includes('require("obsidian")'));
if (!obsidianLine) throw new Error("obsidian require not found in main.js");
src = src.replace(
  obsidianLine,
  `const { Plugin = class {}, ItemView = class {}, MarkdownRenderChild = class {}, MarkdownRenderer = class {}, Modal = class {}, Notice = class { constructor(m){this.m=m} }, PluginSettingTab = class {}, Setting = class {}, setIcon = () => {} } = {};`,
);
src += `\nmodule.exports = { SessionsDashboard, SessionNotes, parseBlockConfig, extractSnippetSessionConfig, normalizeModelRef, deepMerge, deepEqual, mergeConfigChain, diffRootState, missingSkillSources, normalizeInstallCommand, checkSkillInstalls, expandHomePath, splitDirGlobs, directoryInSubtree, directoryMatchesFilter };`;

const tmp = path.join(require("os").tmpdir(), "vibed-dashboard-smoke.js");
fs.writeFileSync(tmp, src);
const {
  SessionsDashboard,
  SessionNotes,
  parseBlockConfig,
  extractSnippetSessionConfig,
  normalizeModelRef,
  deepMerge,
  deepEqual,
  mergeConfigChain,
  diffRootState,
  missingSkillSources,
  checkSkillInstalls,
  expandHomePath,
  splitDirGlobs,
  directoryInSubtree,
  directoryMatchesFilter,
} = require(tmp);

function makeEl(tag, opts = {}) {
  const el = {
    tagName: tag,
    children: [],
    style: {},
    value: "",
    title: "",
    disabled: false,
    listeners: {},
    classes: new Set(),
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    createDiv(o = {}) {
      return this.appendChild(makeEl("div", o));
    },
    createEl(t, o = {}) {
      return this.appendChild(makeEl(t, o));
    },
    createSpan(o = {}) {
      return this.appendChild(makeEl("span", o));
    },
    empty() {
      this.children = [];
    },
    remove() {},
    addClass(c) {
      this.classes.add(c);
    },
    removeClass(c) {
      this.classes.delete(c);
    },
    setText(t) {
      this._text = String(t);
    },
    appendText(t) {
      this._text = (this._text || "") + t;
    },
    contains() {
      return false;
    },
  };
  if (opts.text) el._text = String(opts.text);
  return el;
}

const rows = [
  { id: "ses_1", titleLabel: "Fix parser", stateLabel: "Idle", state: "idle", directoryLabel: "proj", directory: "/x/proj", modelLabel: "Sonnet 4.5", model: "anthropic/sonnet-4-5", agent: "build", tokensLabel: "1k", updatedLabel: "now" },
  { id: "ses_2", titleLabel: "Deploy", stateLabel: "Running…", state: "running", directoryLabel: "proj", directory: "/x/proj", modelLabel: "GPT-5", model: "openai/gpt-5", agent: "build", tokensLabel: "2k", updatedLabel: "now" },
  // Subsession family: ses_2 gains a running child + a finished one —
  // grouping nests both under the parent and derives "delegating".
  { id: "ses_2a", parent_id: "ses_2", titleLabel: "Review diff", stateLabel: "Running…", state: "running", directoryLabel: "proj", directory: "/x/proj", modelLabel: "GPT-5", model: "openai/gpt-5", agent: "explore", tokensLabel: "1k", updatedLabel: "now", time_created: 200 },
  { id: "ses_2b", parent_id: "ses_2", titleLabel: "Old scan", stateLabel: "Idle", state: "idle", directoryLabel: "proj", directory: "/x/proj", modelLabel: "GPT-5", model: "openai/gpt-5", agent: "explore", tokensLabel: "1k", updatedLabel: "then", time_created: 100 },
  // Orphan child (parent not listed) stays a top-level card.
  { id: "ses_3", parent_id: "ses_gone", titleLabel: "Orphan", stateLabel: "Idle", state: "idle", directoryLabel: "proj", directory: "/x/proj", modelLabel: "GPT-5", model: "openai/gpt-5", agent: "build", tokensLabel: "1k", updatedLabel: "then", time_created: 50 },
];
const driver = {
  capabilities: () => ({ listing: "db", live: "sse", chat: true }),
  streamConnected: () => true,
  listSessions: async () => rows,
  loadSessionRowsByIds: async (ids) => ({ rows: rows.filter((r) => ids.includes(r.id)), missing: [] }),
};
const connector = { id: "c1", name: "opencode", kind: "opencode2", enabled: true };
const plugin = {
  settings: { pageSize: 10, notesDir: "vibed-notes" },
  registry: {
    byName: () => ({ connector, driver }),
    defaultConnector: () => ({ connector, driver }),
  },
  notes: new SessionNotes({
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => ({}) } },
    scheduleListRefresh: () => {},
  }),
  subscribe: () => () => {},
  openSession: () => {},
  newSession: () => {},
  openSettings: () => {},
  driverForOptions: () => driver,
  missingSessionRow: (id) => ({ id, titleLabel: id, stateLabel: "", state: "", missing: true }),
};

function findStatus(el) {
  for (const c of el.children) {
    if (c.tagName === "span" && /session/.test(c._text || "")) return c;
    const deep = findStatus(c);
    if (deep) return deep;
  }
  return null;
}

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL — ${name}\n  ${error.stack.split("\n").slice(0, 3).join("\n  ")}`);
  }
};

(async () => {
  await check("directory dashboard mounts and renders a status line", async () => {
    const container = makeEl("div");
    const dash = new SessionsDashboard(plugin, container, {});
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("load never settled")), 3000));
    await Promise.race([dash.mount(), timeout]);
    // 3 top-level sessions (parent absorbs its 2 children; orphan stays).
    const status = (findStatus(container) || {})._text;
    if (!/3 of 5 sessions/.test(status || "")) throw new Error(`unexpected status: ${status}`);
  });

  await check("widget mode (pinned sessions) mounts", async () => {
    const dash = new SessionsDashboard(plugin, makeEl("div"), { sessions: ["ses_1"] });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("load never settled")), 3000));
    await Promise.race([dash.mount(), timeout]);
  });

  await check("filtered render with every criterion set", async () => {
    const dash = new SessionsDashboard(plugin, makeEl("div"), {});
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("load never settled")), 3000));
    await Promise.race([dash.mount(), timeout]);
    dash.filterQuery = { tags: ["x"], states: ["running"], dirs: ["proj"], models: ["sonnet"], phrases: ["fix"] };
    dash.render();
    dash.filterToolsEl = makeEl("div");
    dash.filterMenuEl = dash.filterToolsEl.createDiv();
    dash.renderFilterMenu();
  });

  check("stale filterQuery shape (missing keys) must not crash render", () => {
    const container = makeEl("div");
    const dash = new SessionsDashboard(plugin, container, {});
    dash.sessions = rows;
    dash.listEl = makeEl("div");
    dash.errorEl = makeEl("div");
    dash.moreButton = makeEl("button");
    dash.filterQuery = { tags: [] }; // old shape — regression guard for v0.11.0
    dash.render();
  });

  check("subsessions nest under the parent and derive delegating state", () => {
    const container = makeEl("div");
    const dash = new SessionsDashboard(plugin, container, {});
    dash.sessions = rows;
    dash.listEl = makeEl("div");
    dash.errorEl = makeEl("div");
    dash.moreButton = makeEl("button");
    dash.statusEl = makeEl("span");
    dash.filterQuery = { tags: [], states: [], dirs: [], models: [], phrases: [] };
    dash.render();
    // Three cards: parent absorbed both children; orphan stays top-level.
    const walk = (el, out) => {
      for (const child of el.children || []) {
        if (child._text) out.push(child._text);
        walk(child, out);
      }
    };
    const texts = [];
    walk(dash.listEl, texts);
    if (!texts.includes("Deploy")) throw new Error("parent card missing");
    if (texts.includes("Review diff") === false) throw new Error("active subsession not listed");
    if (texts.includes("Old scan")) throw new Error("finished subsession visible while collapsed");
    if (!texts.some((t) => /1 of 2 subagents running/.test(t))) throw new Error("subs summary missing");
    if (!texts.includes("Subagents running")) throw new Error("delegating state label missing");
    // Expand: all children now listed.
    dash.expandedSubs.add("ses_2");
    dash.render();
    const texts2 = [];
    walk(dash.listEl, texts2);
    if (!texts2.includes("Old scan")) throw new Error("expand does not show finished subsession");
    if (!texts2.some((t) => /1 of 2 subagents running/.test(t))) throw new Error("subs summary missing after expand");
    // Orphan child still rendered as its own card.
    if (!texts2.includes("Orphan")) throw new Error("orphan subsession dropped");
  });

  check("parseBlockConfig parses inline JSON values and list items", () => {
    const config = parseBlockConfig(
      [
        "connector: opencode",
        'mcp: {"kangram": {"type": "remote", "url": "https://k.example"}}',
        "skills:",
        "  - ./skills/analysis",
        '  - {"install": "npx skills add owner/repo"}',
      ].join("\n"),
    );
    if (config.connector !== "opencode") throw new Error("plain key lost");
    if (config.mcp?.kangram?.type !== "remote") throw new Error("inline JSON value not parsed");
    if (config.skills[0] !== "./skills/analysis") throw new Error("string list item lost");
    if (config.skills[1]?.install !== "npx skills add owner/repo") throw new Error("JSON list item not parsed");
  });

  check("extractSnippetSessionConfig splits ephemeral/root/installs", () => {
    const snippet = extractSnippetSessionConfig({
      connector: "opencode",
      model: "zai/glm-5.3#fast",
      permissions: [{ action: "edit", resource: "*", effect: "allow" }],
      environment: { API_SCOPE: "research" },
      mcp: { kangram: { type: "remote", url: "https://k.example" } },
      skills: [
        "./skills/analysis",
        { install: "npx skills add owner/repo" },
        { id: "deep-research", install: "npx skills add zema/skill" },
      ],
    });
    if (!snippet) throw new Error("snippet not detected");
    if (snippet.ephemeral.model !== "zai/glm-5.3#fast") throw new Error("ephemeral model lost");
    if (!Array.isArray(snippet.ephemeral.permissions)) throw new Error("permissions lost");
    if (snippet.rootState.mcp?.kangram?.type !== "remote") throw new Error("root mcp lost");
    if (snippet.rootState.skills.join(",") !== "./skills/analysis") throw new Error("skills sources wrong");
    if (snippet.installs.length !== 2) throw new Error("installs wrong");
    if (snippet.installs[1].id !== "deep-research") throw new Error("declared id lost");
    if (extractSnippetSessionConfig({ connector: "x", dirs: ["a"] }) !== null) {
      throw new Error("no-config block should yield null");
    }
    let threw = false;
    try {
      extractSnippetSessionConfig({ skills: [{ nope: true }] });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error("malformed skill entry should throw");
  });

  check("mergeConfigChain honors precedence; diffRootState is subset-only", () => {
    const chain = [
      { type: "document", path: "/global.json", info: { mcp: { servers: { a: { url: "1" }, b: { url: "2" } } } } },
      { type: "directory", path: "/home" },
      { type: "document", path: "/proj/.opencode/opencode.json", info: { mcp: { servers: { b: { url: "3" } } } } },
    ];
    const effective = mergeConfigChain(chain);
    if (effective.mcp.servers.a.url !== "1") throw new Error("ancestor lost");
    if (effective.mcp.servers.b.url !== "3") throw new Error("local did not override");
    const desired = { mcp: { servers: { b: { url: "3" }, kangram: { url: "4" } } } };
    const changes = diffRootState(desired, effective);
    if (changes.length !== 1 || changes[0].path !== "mcp.servers.kangram.url" || changes[0].kind !== "add") {
      throw new Error(`unexpected diff: ${JSON.stringify(changes)}`);
    }
    if (diffRootState({ mcp: { servers: { b: { url: "3" } } } }, effective).length) {
      throw new Error("satisfied subset should not diff");
    }
    const changed = diffRootState({ mcp: { servers: { b: { url: "9" } } } }, effective);
    if (changed.length !== 1 || changed[0].kind !== "change") throw new Error("value change not detected");
  });

  check("missingSkillSources is subset-of-array", () => {
    const effective = { skills: ["./a", "./b"] };
    if (missingSkillSources(["./b"], effective).length) throw new Error("present source flagged");
    const missing = missingSkillSources(["./b", "./c"], effective);
    if (missing.join(",") !== "./c") throw new Error(`unexpected missing: ${missing}`);
    if (missingSkillSources(["./c"], {}).length !== 1) throw new Error("no-skills config must miss everything");
  });

  check("checkSkillInstalls: declared id, learned manifest, unknown", () => {
    const result = checkSkillInstalls(
      [
        { id: "deep-research", install: "npx skills add zema/skill" },
        { id: null, install: "npx skills add owner/repo" }, // whitespace differs from manifest — must still match
        { id: null, install: "npx skills add unknown/pkg" },
      ],
      new Set(["deep-research", "other"]),
      { installs: [{ command: "npx   skills add owner/repo", ids: ["other"] }] },
    );
    if (!result[0].satisfied) throw new Error("declared id should satisfy");
    if (!result[1].satisfied) throw new Error("learned manifest should satisfy");
    if (result[2].satisfied) throw new Error("unknown command must stay a diff");
  });

  check("normalizeModelRef parses string and object refs", () => {
    const ref = normalizeModelRef("zai/glm-5.3#fast");
    if (!ref || ref.providerID !== "zai" || ref.id !== "glm-5.3" || ref.variant !== "fast") {
      throw new Error(`string ref: ${JSON.stringify(ref)}`);
    }
    const obj = normalizeModelRef({ providerID: "zai", model: "glm-5.3" });
    if (!obj || obj.id !== "glm-5.3") throw new Error("object ref");
    if (normalizeModelRef("not-a-ref") !== null) throw new Error("garbage should be null");
  });

  check("expandHomePath expands ~ and ~/, leaves the rest", () => {
    const home = require("os").homedir();
    if (expandHomePath("~") !== home) throw new Error("bare ~ not expanded");
    if (expandHomePath("~/spaces") !== path.join(home, "spaces")) throw new Error("~/… not expanded");
    if (expandHomePath("/abs/path") !== "/abs/path") throw new Error("absolute touched");
    if (expandHomePath("~other") !== "~other") throw new Error("foreign tilde touched");
  });

  check("splitDirGlobs separates exact entries from /* subtrees", () => {
    const { exact, subtree } = splitDirGlobs(["/a/b", "/a/c/*", "/*", "", "/a/d/*/"]);
    if (!exact.has("/a/b")) throw new Error("exact entry lost");
    if (!subtree.has("/a/c")) throw new Error("subtree base wrong");
    if (!subtree.has("")) throw new Error("root glob should degrade to ''");
    if (exact.has("/a/d/*") || subtree.has("/a/d")) throw new Error("trailing-slash glob mishandled");
  });

  check("directoryInSubtree is boundary-safe", () => {
    if (!directoryInSubtree("/a/b", "/a")) throw new Error("child rejected");
    if (!directoryInSubtree("/a", "/a")) throw new Error("self rejected");
    if (directoryInSubtree("/a-b", "/a")) throw new Error("sibling accepted");
  });

  check("directoryMatchesFilter honors subtrees (path + encoded slug)", () => {
    const empty = new Set();
    if (!directoryMatchesFilter({ directory: "/a/b/c" }, empty, empty, new Set(["/a"]))) {
      throw new Error("real-cwd subtree rejected");
    }
    if (directoryMatchesFilter({ directory: "/x/b" }, empty, empty, new Set(["/a"]))) {
      throw new Error("outside subtree accepted");
    }
    if (!directoryMatchesFilter({ encodedDir: "-Users-roman-spaces-kangram" }, empty, empty, new Set(["/Users/roman/spaces"]))) {
      throw new Error("encoded subtree rejected");
    }
    if (directoryMatchesFilter({ encodedDir: "-Users-roman-spaces-other" }, new Set(["/nope"]), new Set(["nope"]), new Set(["/unrelated"]))) {
      throw new Error("encoded non-match accepted");
    }
    if (!directoryMatchesFilter({ directory: "/any" }, empty, empty, empty)) {
      throw new Error("empty filter must list everything");
    }
  });

  check("dashboards surface ~ errors and /* warnings for API-only connectors", () => {
    const remoteDriver = Object.assign({}, driver, {
      directoryCapabilities: () => ({ home: false, subtree: false }),
    });
    const remoteEntry = { connector: Object.assign({}, connector), driver: remoteDriver };
    const remotePlugin = {
      ...plugin,
      registry: {
        byName: () => remoteEntry,
        defaultConnector: () => remoteEntry,
      },
    };
    const collect = (options) => {
      const dash = new SessionsDashboard(remotePlugin, makeEl("div"), options);
      dash.refreshConnectorBinding(); // load() does this before computing notices
      return dash.computeNotices();
    };
    const homeNotices = collect({ dirs: ["~/*"] });
    if (!homeNotices.errors.length || !/Can't resolve/.test(homeNotices.errors[0])) {
      throw new Error(`~ entry must error: ${JSON.stringify(homeNotices)}`);
    }
    if (homeNotices.warnings.length) throw new Error("~ error should take precedence over glob warning");
    const globNotices = collect({ dirs: ["/srv/*"] });
    if (globNotices.errors.length) throw new Error("absolute glob must not error");
    if (!globNotices.warnings.length || !/Subtree dirs/.test(globNotices.warnings[0])) {
      throw new Error(`subtree entry must warn: ${JSON.stringify(globNotices)}`);
    }
    // Local-capable drivers raise no notices for the same entries.
    const dash = new SessionsDashboard(plugin, makeEl("div"), { dirs: ["/x/*", "~"] });
    dash.connectorEntry = plugin.registry.defaultConnector();
    const localNotices = dash.computeNotices();
    if (localNotices.errors.length || localNotices.warnings.length) {
      throw new Error(`local connector should be quiet: ${JSON.stringify(localNotices)}`);
    }
  });

  check("deepMerge replaces arrays and recurses objects", () => {
    const merged = deepMerge({ a: { x: 1, y: 2 }, list: [1, 2] }, { a: { y: 9 }, list: [3] });
    if (merged.a.x !== 1 || merged.a.y !== 9) throw new Error("object merge wrong");
    if (merged.list.length !== 1 || merged.list[0] !== 3) throw new Error("arrays must replace");
    if (!deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })) throw new Error("equal rejected");
    if (deepEqual({ a: 1 }, { a: 2 })) throw new Error("unequal accepted");
  });

  fs.unlinkSync(tmp);
  if (failures) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall dashboard smoke checks passed");
})();
