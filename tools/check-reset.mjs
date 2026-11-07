// Check: Start over closes space + Favorite tabs, keeps other tabs, deletes spaces/backup/bookmarks, keeps dock.
const store = { local: {}, session: {} };
const area = (a) => ({ get: async (k) => (k == null ? { ...store[a] } : typeof k === "string" ? { [k]: store[a][k] } : {}), set: async (o) => Object.assign(store[a], o),
  remove: async (k) => [].concat(k).forEach((x) => delete store[a][x]) });
let tabs = [{ id: 1, pinned: true, groupId: -1, windowId: 1 }, { id: 2, groupId: 10, windowId: 1 }, { id: 3, groupId: -1, windowId: 1 }];
const bm = { "0": { id: "0", children: [{ id: "2", children: [{ id: "9", title: "Spaces+", children: [{ id: "10", title: "★ Favorites", children: [] }] }] }] } };
let removedTree;
globalThis.chrome = {
  storage: { local: area("local"), session: area("session") },
  tabGroups: { query: async () => [{ id: 10, title: "Work" }] },
  tabs: { query: async () => tabs, create: async () => tabs.push({ id: 99 }), remove: async (ids) => (tabs = tabs.filter((t) => !ids.includes(t.id))) },
  bookmarks: { getTree: async () => [bm["0"]], getChildren: async (id) => (id === "2" ? bm["0"].children[0].children : id === "9" ? bm["0"].children[0].children[0].children : []),
    get: async () => [], create: async () => ({}), removeTree: async (id) => (removedTree = id) },
};
store.local = { spaces: [{ id: "a", name: "Work" }], backup: { spaces: {} }, settings: { tint: 50 } };
store.session = { dock: { id: 5 }, links: {}, "active:1": "a" };
const core = await import("./core.js");
await core.resetAll();
const ok = JSON.stringify(tabs.map((t) => t.id)) === "[3]" && removedTree === "9" && !store.local.spaces && !store.local.backup
  && store.local.settings.tint === 50 && store.session.dock && !store.session.links && !store.session.resetting;
console.log(ok ? "PASS" : "FAIL", JSON.stringify({ tabs, removedTree, store }));
process.exit(ok ? 0 : 1);
