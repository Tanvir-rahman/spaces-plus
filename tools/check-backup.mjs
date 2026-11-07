// Check: backup survives window closing, restore reopens only missing tabs, second restore does nothing.
const L = {}; const ev = (n) => ({ addListener: (f) => (L[n] ||= []).push(f) });
const store = { local: {}, session: {} };
const area = (a) => ({ get: async (k) => (k == null ? { ...store[a] } : { [k]: store[a][k] }), set: async (o) => Object.assign(store[a], structuredClone(o)), remove: async (k) => delete store[a][k] });
let tabs = [], groups = [], nid = 1;
globalThis.chrome = {
  storage: { local: area("local"), session: area("session"), onChanged: ev("storage") },
  sidePanel: { setPanelBehavior: async () => {} },
  action: { onClicked: ev("action") }, commands: { onCommand: ev("cmd") },
  runtime: { onInstalled: ev("inst"), onStartup: ev("start") },
  system: { display: { getInfo: async () => [] } },
  bookmarks: {},
  windows: { get: async (id) => (id === 1 ? { id: 1, type: "normal", state: "normal" } : Promise.reject()), getLastFocused: async () => ({ id: 1 }), getAll: async () => [], create: async () => ({ id: 1 }), update: async () => {},
    onBoundsChanged: ev("b"), onFocusChanged: ev("f"), onRemoved: ev("wr"), onCreated: ev("wc") },
  tabs: { query: async () => tabs.map((t) => ({ ...t })), get: async (id) => tabs.find((t) => t.id === id),
    create: async (o) => { const t = { id: nid++, url: o.url, groupId: -1, windowId: 1 }; tabs.push(t); return t; },
    group: async ({ tabIds, groupId }) => { let g = groupId ?? (groups.push({ id: 100 + groups.length, title: "" }), 100 + groups.length - 1); tabs.forEach((t) => tabIds.includes(t.id) && (t.groupId = g)); return g; },
    update: async () => {}, discard: async (id) => { tabs.find((t) => t.id === id).discarded = true; },
    onCreated: ev("tc"), onMoved: ev("tm"), onAttached: ev("ta"), onDetached: ev("td"), onUpdated: ev("tu"), onRemoved: ev("tr"), onActivated: ev("tact") },
  tabGroups: { query: async () => groups.map((g) => ({ ...g })), update: async (id, o) => Object.assign(groups.find((g) => g.id === id), o), onUpdated: ev("gu") },
};
store.local.spaces = [{ id: "a", name: "Work", color: "blue" }, { id: "b", name: "Fun", color: "red" }];
store.local.settings = { look: 4, modeV: 1, mode: "panel" };
groups = [{ id: 100, title: "Work" }, { id: 101, title: "Fun" }];
tabs = [{ id: 50, url: "https://a.com", groupId: 100 }, { id: 51, url: "https://b.com", groupId: 100 }, { id: 52, url: "https://c.com", groupId: 101 }, { id: 53, url: "chrome://newtab/", groupId: 101 }];
globalThis.setTimeout = ((st) => (f, ms) => st(f, Math.min(ms, 20)))(setTimeout);
await import("./background.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
L.tc.forEach((f) => f({ id: 50 })); await wait(80);
const assert = (c, m) => { if (!c) { console.log("FAIL", m, JSON.stringify(store.local.backup)); process.exit(1); } };
assert(store.local.backup?.spaces.a.length === 2 && store.local.backup.spaces.b.length === 1, "snapshot");
// Chrome quits: tabs removed with isWindowClosing -> backup kept
tabs = []; L.tr.forEach((f) => f(50, { isWindowClosing: true })); await wait(80);
assert(store.local.backup.spaces.a.length === 2, "kept on window close");
// Startup with one tab already back (b.com): only a.com and c.com reopen
groups = []; tabs = [{ id: 60, url: "https://b.com", groupId: -1 }]; nid = 70;
L.start[0](); await wait(150);
const urls = tabs.map((t) => t.url).sort();
assert(JSON.stringify(urls) === JSON.stringify(["https://a.com", "https://b.com", "https://c.com"]), "restore " + urls);
assert(tabs.filter((t) => t.id >= 70).every((t) => t.discarded), "asleep");
assert(groups.map((g) => g.title).sort().join() === "Fun,Work", "groups " + JSON.stringify(groups));
// Second restore: nothing new
L.start[0](); await wait(150);
assert(tabs.length === 3, "no duplicates");
console.log("PASS", store.session.restored);
