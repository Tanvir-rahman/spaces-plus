// Shared logic for the sidebar and the background worker.
// Model: a "space" = a named Chrome tab group + a bookmark folder holding its pinned tabs.
// Spaces live in extension storage so they survive even when their group has no open tabs.

export const COLORS = {
  grey:   { dot: "#6f6e78", light: "#e3e2e8", dark: "#232228" },
  blue:   { dot: "#2f6fe4", light: "#cddffb", dark: "#15233b" },
  red:    { dot: "#d8433b", light: "#f6d2ce", dark: "#37191a" },
  yellow: { dot: "#b9860b", light: "#f3e4b2", dark: "#2f2814" },
  green:  { dot: "#23864d", light: "#cbe9d5", dark: "#132a1e" },
  pink:   { dot: "#cc3f87", light: "#f5d0e3", dark: "#34182b" },
  purple: { dot: "#7448e8", light: "#ded5fa", dark: "#221a3b" },
  cyan:   { dot: "#12899a", light: "#c7e8ed", dark: "#11292e" },
  orange: { dot: "#d6691c", light: "#f8d9c0", dark: "#35220f" },
};
export const COLOR_NAMES = Object.keys(COLORS);
export const ROOT_TITLE = "Spaces Plus";
const FAV_TITLE = "★ Favorites";

const local = chrome.storage.local;
const session = chrome.storage.session;
const get = async (area, k, d) => (await area.get(k))[k] ?? d;
const put = (area, k, v) => area.set({ [k]: v });

export const getSpaces = () => get(local, "spaces", []);
export const saveSpaces = (s) => put(local, "spaces", s);
export const getLinks = () => get(session, "links", {}); // bookmarkId -> tabId
export const saveLinks = (l) => put(session, "links", l);
export const DEFAULTS = {
  look: 4, modeV: 1,
  // sidebar
  mode: "window", dockWidth: 240,
  // what to show
  showNav: true, showUrl: true, showFavs: true, showHead: true, showNew: true, showClear: true, showDock: true, showHints: true,
  // sizes
  fontSize: 13.5, rowHeight: 36, favSize: 54, radius: 10, pad: 10,
  // look
  theme: "auto", tint: 30, background: "gradient", dockStyle: "auto", bgMode: "space", bgColor: "#e6e1f4",
  // behaviour
  sleepOnSwitch: true, autoGroup: true, restoreTabs: true,
};
export async function getSettings() {
  const saved = await get(local, "settings", {});
  if (saved.modeV !== 1) { // v4.1: floating sidebar on the left became the default
    delete saved.mode;
    saved.modeV = 1;
    await put(local, "settings", saved);
  }
  if (saved.look !== 4) { // v4 moved to Arc-like sizes: drop old size/look values once so the new ones show
    for (const k of ["compact", "fontSize", "rowHeight", "favSize", "radius", "pad", "tint", "background", "dockStyle"]) delete saved[k];
    saved.look = 4;
    await put(local, "settings", saved);
  }
  return { ...DEFAULTS, ...saved };
}
export const saveSettings = (s) => put(local, "settings", s);
export const setLastTab = (spaceId, tabId) => put(session, "last:" + spaceId, tabId);
export const setActive = (winId, id) => put(session, "active:" + winId, id);

// A space's colour: a custom hex if set, else its Chrome group colour.
export const spaceHex = (s) => s?.hex || COLORS[s?.color]?.dot || COLORS.grey.dot;

// Chrome groups only take 9 colours, so a custom colour maps to the closest one.
export function nearestColor(hex) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best = "grey", d = Infinity;
  for (const n of COLOR_NAMES) {
    const [r2, g2, b2] = rgb(COLORS[n].dot);
    const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (dd < d) { d = dd; best = n; }
  }
  return best;
}

// A random colour, preferring ones no other space uses yet. Never grey.
export function pickColor(spaces) {
  const pool = COLOR_NAMES.filter((c) => c !== "grey");
  const uses = (c) => spaces.filter((s) => !s.hex && s.color === c).length;
  const least = Math.min(...pool.map(uses));
  const free = pool.filter((c) => uses(c) === least);
  return free[Math.floor(Math.random() * free.length)];
}

const groupsNamed = async (name) => (await chrome.tabGroups.query({})).filter((g) => g.title === name);

export async function renameSpace(id, name) {
  const spaces = await getSpaces();
  const s = spaces.find((x) => x.id === id);
  name = name?.trim();
  if (!s || !name || name === s.name) return;
  while (spaces.some((x) => x.name === name)) name += " 2";
  const gs = await groupsNamed(s.name);
  s.name = name;
  await saveSpaces(spaces);
  for (const g of gs) await chrome.tabGroups.update(g.id, { title: name });
  if (s.folderId) await chrome.bookmarks.update(s.folderId, { title: name }).catch(() => {});
}

// color: a Chrome colour name or a "#rrggbb" custom colour.
export async function recolorSpace(id, color) {
  const spaces = await getSpaces();
  const s = spaces.find((x) => x.id === id);
  if (!s) return;
  if (color.startsWith("#")) { s.hex = color; s.color = nearestColor(color); }
  else { delete s.hex; s.color = color; }
  await saveSpaces(spaces);
  for (const g of await groupsNamed(s.name)) await chrome.tabGroups.update(g.id, { color: s.color });
}

export async function setSpaceIcon(id, icon) {
  const spaces = await getSpaces();
  const s = spaces.find((x) => x.id === id);
  if (!s) return;
  if (icon?.trim()) s.icon = icon.trim(); else delete s.icon;
  await saveSpaces(spaces);
}

export async function moveSpace(id, dir) {
  const spaces = await getSpaces();
  const i = spaces.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= spaces.length) return;
  [spaces[i], spaces[j]] = [spaces[j], spaces[i]];
  await saveSpaces(spaces);
}

// Drag-to-reorder: put space `id` at position `to`.
export async function placeSpace(id, to) {
  const spaces = await getSpaces();
  const i = spaces.findIndex((x) => x.id === id);
  if (i < 0 || i === to) return;
  spaces.splice(to, 0, ...spaces.splice(i, 1));
  await saveSpaces(spaces);
}

export async function getActive(winId, spaces) {
  const id = await get(session, "active:" + winId);
  return spaces.find((s) => s.id === id) || spaces[0];
}

// Start over: close space and Favorite tabs, delete all spaces, pins, Favorites and the backup.
// Leaves one new tab open so Chrome doesn't close. Look settings are kept.
export async function resetAll() {
  await put(session, "resetting", true); // pauses syncSpaces so nothing half-deleted gets re-adopted
  try { await wipe(); } finally { await session.remove("resetting"); } // sidebar then reloads with a fresh "Home" space
}
async function wipe() {
  const spaces = await getSpaces();
  const names = new Set(spaces.map((s) => s.name));
  const gids = new Set((await chrome.tabGroups.query({})).filter((g) => names.has(g.title)).map((g) => g.id));
  const all = await chrome.tabs.query({ windowType: "normal" });
  const doomed = all.filter((t) => t.pinned || gids.has(t.groupId)).map((t) => t.id);
  if (all.length && doomed.length === all.length) await chrome.tabs.create({ windowId: all[0].windowId });
  if (doomed.length) await chrome.tabs.remove(doomed);
  const { root } = await folders();
  await chrome.bookmarks.removeTree(root).catch(() => {});
  cache = null;
  await local.remove(["spaces", "backup"]);
  const keep = ["dock", "resetting"]; // the floating window stays open
  await session.remove(Object.keys(await session.get(null)).filter((k) => !keep.includes(k)));
}

let cache;
export async function folders() {
  if (cache) {
    try { await chrome.bookmarks.get([cache.root, cache.favs]); return cache; } catch { /* deleted, rebuild */ }
  }
  const [tree] = await chrome.bookmarks.getTree();
  const other = tree.children.find((c) => c.id === "2") || tree.children[1] || tree.children[0];
  const top = await chrome.bookmarks.getChildren(other.id);
  // Folder was called "Spaces+" before the rename: adopt and rename it.
  const old = top.find((c) => !c.url && c.title === "Spaces+");
  if (old) await chrome.bookmarks.update(old.id, { title: ROOT_TITLE });
  const root = top.find((c) => !c.url && c.title === ROOT_TITLE) || old
    || await chrome.bookmarks.create({ parentId: other.id, title: ROOT_TITLE });
  const kids = await chrome.bookmarks.getChildren(root.id);
  const favs = kids.find((c) => !c.url && c.title === FAV_TITLE)
    || await chrome.bookmarks.create({ parentId: root.id, title: FAV_TITLE, index: 0 });
  return (cache = { root: root.id, favs: favs.id });
}

// Make spaces match reality: adopt orphan bookmark folders and tab groups, give every space a folder.
export async function syncSpaces(winId) {
  if (await get(session, "resetting")) throw new Error("Start over in progress");
  const spaces = await getSpaces();
  const { root, favs } = await folders();
  const kids = (await chrome.bookmarks.getChildren(root)).filter((k) => !k.url && k.id !== favs);
  let changed = false;
  for (const k of kids) {
    if (!spaces.some((s) => s.folderId === k.id || s.name === k.title)) {
      spaces.push({ id: crypto.randomUUID(), name: k.title, color: pickColor(spaces), folderId: k.id });
      changed = true;
    }
  }
  for (const g of await chrome.tabGroups.query({ windowId: winId })) {
    if (!g.title) { g.title = "Untitled"; chrome.tabGroups.update(g.id, { title: g.title }); }
    if (!spaces.some((s) => s.name === g.title)) {
      const color = g.color && g.color !== "grey" ? g.color : pickColor(spaces);
      if (color !== g.color) chrome.tabGroups.update(g.id, { color }).catch(() => {});
      spaces.push({ id: crypto.randomUUID(), name: g.title, color });
      changed = true;
    }
  }
  if (!spaces.length) { spaces.push({ id: crypto.randomUUID(), name: "Home", color: pickColor(spaces) }); changed = true; }
  if (!(await get(local, "greyFixed"))) { // once: grey spaces from older versions get a real colour
    for (const s of spaces) {
      if (s.hex || s.color !== "grey") continue;
      s.color = pickColor(spaces.filter((x) => x !== s));
      for (const g of await groupsNamed(s.name)) chrome.tabGroups.update(g.id, { color: s.color }).catch(() => {});
      changed = true;
    }
    await put(local, "greyFixed", true);
  }
  for (const s of spaces) {
    if (!s.folderId || !kids.some((k) => k.id === s.folderId)) {
      const f = kids.find((k) => k.title === s.name) || await chrome.bookmarks.create({ parentId: root, title: s.name });
      s.folderId = f.id;
      changed = true;
    }
  }
  if (changed) await saveSpaces(spaces);
  return spaces;
}

export async function groupOf(space, winId) {
  return (await chrome.tabGroups.query({ windowId: winId })).find((g) => g.title === space.name);
}

export async function spaceOfGroup(groupId) {
  if (groupId == null || groupId < 0) return null;
  const g = await chrome.tabGroups.get(groupId).catch(() => null);
  return g && (await getSpaces()).find((s) => s.name === g.title);
}

export async function addToSpace(tabIds, space, winId) {
  const g = await groupOf(space, winId);
  if (g) return chrome.tabs.group({ tabIds, groupId: g.id });
  const id = await chrome.tabs.group({ tabIds, createProperties: { windowId: winId } });
  await chrome.tabGroups.update(id, { title: space.name, color: space.color });
  return id;
}

export async function openInSpace(space, winId, url) {
  const tab = await chrome.tabs.create({ windowId: winId, url, active: true });
  if (tab.pinned) await chrome.tabs.update(tab.id, { pinned: false });
  await addToSpace([tab.id], space, winId);
  return tab;
}

export async function switchSpace(winId, space) {
  await setActive(winId, space.id);
  const [groups, tabs, settings, lastId] = await Promise.all([
    chrome.tabGroups.query({ windowId: winId }),
    chrome.tabs.query({ windowId: winId }),
    getSettings(),
    get(session, "last:" + space.id),
  ]);
  const g = groups.find((x) => x.title === space.name);
  const inSpace = g ? tabs.filter((t) => t.groupId === g.id) : [];
  if (g) await chrome.tabGroups.update(g.id, { collapsed: false });
  const target = inSpace.find((t) => t.id === lastId) || inSpace[0];
  if (target) await chrome.tabs.update(target.id, { active: true });
  else await openInSpace(space, winId);
  for (const o of groups) if (o.id !== g?.id) chrome.tabGroups.update(o.id, { collapsed: true }).catch(() => {});
  if (settings.sleepOnSwitch) {
    for (const t of tabs) {
      if (t.groupId >= 0 && t.groupId !== g?.id && !t.active && !t.audible && !t.discarded) {
        chrome.tabs.discard(t.id).catch(() => {});
      }
    }
  }
}

export async function stepSpace(winId, dir) {
  const spaces = await getSpaces();
  if (spaces.length < 2) return;
  const cur = await getActive(winId, spaces);
  const i = spaces.indexOf(cur);
  await switchSpace(winId, spaces[(i + dir + spaces.length) % spaces.length]);
}

// Put a just-created tab to sleep once its page has loaded. Discarding sooner leaves a blank tab.
// ponytail: if it never finishes loading within 60 s it just stays awake.
export function sleepWhenReady(id) {
  const done = () => chrome.tabs.onUpdated.removeListener(on);
  const on = (tid, c, t) => {
    if (tid !== id || t.status !== "complete" || !t.url || t.url === "about:blank") return;
    done();
    chrome.tabs.discard(id).catch(() => {});
  };
  chrome.tabs.onUpdated.addListener(on);
  setTimeout(done, 60000);
}

// ---------- move to another browser: one backup file ----------
const REAL_URL = /^(https?|file):/;
const marks = async (folderId) => (await chrome.bookmarks.getChildren(folderId).catch(() => []))
  .filter((b) => b.url).map((b) => ({ title: b.title, url: b.url }));

export async function exportAll() {
  const [spaces, settings, { favs }, tabs, groups] = await Promise.all([
    getSpaces(), getSettings(), folders(), chrome.tabs.query({ windowType: "normal" }), chrome.tabGroups.query({}),
  ]);
  const title = new Map(groups.map((g) => [g.id, g.title]));
  return {
    app: "Spaces Plus", version: 1, exportedAt: new Date().toISOString(), settings,
    favorites: await marks(favs),
    spaces: await Promise.all(spaces.map(async (s) => ({
      name: s.name, color: s.color, hex: s.hex, icon: s.icon,
      pinned: s.folderId ? await marks(s.folderId) : [],
      tabs: tabs.filter((t) => title.get(t.groupId) === s.name && REAL_URL.test(t.url || ""))
        .map((t) => ({ title: t.title, url: t.url })),
    }))),
  };
}

// Adds the file's spaces to what's here (same name = same space). Nothing is deleted.
// Tabs open asleep, so a big import doesn't slow the browser down. Returns counts.
export async function importAll(data, winId) {
  if (data?.app !== "Spaces Plus" || !Array.isArray(data.spaces)) throw new Error("This isn't a Spaces Plus backup file.");
  const spaces = await getSpaces();
  const { root, favs } = await folders();
  const addMarks = async (folderId, list = []) => {
    const have = new Set((await marks(folderId)).map((b) => b.url));
    for (const b of list) if (REAL_URL.test(b.url) && !have.has(b.url)) await chrome.bookmarks.create({ parentId: folderId, title: b.title, url: b.url });
  };
  if (data.settings && typeof data.settings === "object") await saveSettings({ ...(await getSettings()), ...data.settings });
  await addMarks(favs, data.favorites);
  const openNow = new Set((await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
  let nSpaces = 0, nTabs = 0;
  for (const d of data.spaces) {
    if (!d?.name) continue;
    let s = spaces.find((x) => x.name === d.name);
    if (!s) {
      s = { id: crypto.randomUUID(), name: d.name, color: COLORS[d.color] ? d.color : pickColor(spaces) };
      if (/^#[0-9a-f]{6}$/i.test(d.hex || "")) s.hex = d.hex;
      if (d.icon) s.icon = d.icon;
      spaces.push(s);
      nSpaces++;
    }
    if (!s.folderId) s.folderId = (await chrome.bookmarks.create({ parentId: root, title: s.name })).id;
    await saveSpaces(spaces);
    await addMarks(s.folderId, d.pinned);
    const ids = [];
    for (const t of d.tabs || []) {
      if (!REAL_URL.test(t.url) || openNow.has(t.url)) continue;
      openNow.add(t.url);
      ids.push((await chrome.tabs.create({ windowId: winId, url: t.url, active: false })).id);
    }
    if (ids.length) {
      await addToSpace(ids, s, winId);
      for (const id of ids) sleepWhenReady(id);
      nTabs += ids.length;
    }
  }
  return { spaces: nSpaces, tabs: nTabs };
}
