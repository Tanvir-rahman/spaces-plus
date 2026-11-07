import * as core from "./core.js";

const { COLORS, COLOR_NAMES } = core;
const $ = (s) => document.querySelector(s);
const sysDark = matchMedia("(prefers-color-scheme: dark)");
const docked = new URLSearchParams(location.search).has("dock"); // running in the floating window

// ---------- tiny helpers ----------
const ICONS = {
  back: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  fwd: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  reload: '<path d="M12.8 8.5A4.8 4.8 0 1 1 11.4 4.6"/><path d="M12.5 2.5v2.7H9.8"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  x: '<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>',
  minus: '<path d="M4.5 8h7"/>',
  more: '<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>',
  sliders: '<path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.6" fill="var(--bg)"/><circle cx="10.5" cy="11" r="1.6" fill="var(--bg)"/>',
  sound: '<path d="M3 6.2h2.2L8 3.5v9L5.2 9.8H3z"/><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8"/>',
  muted: '<path d="M3 6.2h2.2L8 3.5v9L5.2 9.8H3z"/><path d="m10.5 6.3 3 3.4M13.5 6.3l-3 3.4"/>',
  link: '<path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l1.9-1.9a2.8 2.8 0 0 0-4-4l-.8.8"/><path d="M9.2 6.8a2.8 2.8 0 0 0-4 0L3.3 8.7a2.8 2.8 0 0 0 4 4l.8-.8"/>',
  search: '<circle cx="7" cy="7" r="4.3"/><path d="m10.3 10.3 3.2 3.2"/>',
  box: '<rect x="2.5" y="3" width="11" height="3.2" rx="1"/><path d="M3.5 6.2v5.8a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V6.2M6.5 8.8h3"/>',
  download: '<circle cx="8" cy="8" r="5.8"/><path d="M8 5v5.4M5.8 8.3 8 10.5l2.2-2.2"/>',
  stack: '<rect x="5" y="2.5" width="8.5" height="9" rx="1.6"/><path d="M3 5.2v7a1.6 1.6 0 0 0 1.6 1.6H10"/>',
  left: '<path d="M13 8H3.5M7.2 4.3 3.5 8l3.7 3.7"/>',
  down: '<path d="M8 3.5v9M4.5 9 8 12.5 11.5 9"/>',
  globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.6 2.3 3.4 2.3 5.5S9.6 11.9 8 13.5C6.4 11.9 5.7 10.1 5.7 8S6.4 4.1 8 2.5z"/>',
};
const svg = (n) => `<svg viewBox="0 0 16 16">${ICONS[n]}</svg>`; // constants only, never page data

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text; // textContent: titles come from web pages
  return e;
}
function iconBtn(name, title, run) {
  const b = el("button", "ib");
  b.innerHTML = svg(name);
  b.title = title;
  b.onclick = (e) => { e.stopPropagation(); act(run); };
  return b;
}
function favicon(src, url, title) {
  const box = el("span", "fi");
  const letter = () => { box.replaceChildren(); box.classList.add("letter"); box.textContent = (title || host(url) || "?").trim()[0]?.toUpperCase() || "?"; };
  let s = src && /^(https?|data):/.test(src) ? src : null;
  if (!s && url && /^(https?|file):/.test(url)) s = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  if (!s) { box.innerHTML = svg("globe"); return box; }
  const img = el("img");
  img.src = s;
  img.onerror = letter;
  box.append(img);
  return box;
}
function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function prettyUrl(node, url) {
  node.replaceChildren();
  if (!url || /^chrome:\/\/newtab/.test(url)) { node.append("Search or enter address"); return; }
  try {
    const u = new URL(url);
    const h = el("b", null, u.hostname.replace(/^www\./, ""));
    node.append(h, u.pathname.length > 1 ? u.pathname : "");
  } catch { node.append(url); }
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 1400);
}
const copy = (text) => navigator.clipboard.writeText(text).then(() => toast("Link copied"));

// ---------- state ----------
let winId, spaces = [], active, tabs = [], groups = [], links = {}, favs = [], pins = [], settings = {}, group;
let favFolder;
const tabById = (id) => tabs.find((t) => t.id === id);
const bmById = (id) => [...pins, ...favs].find((b) => b.id === id);
const linkedIds = () => new Set(Object.values(links));
const linkOf = (tabId) => Object.keys(links).find((k) => links[k] === tabId);

// All reads and writes run one after another, so a render never sees half-finished changes.
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn).catch((e) => console.error(e)));
let timer;
function queue() { clearTimeout(timer); timer = setTimeout(() => serial(async () => { await load(); render(); }), 50); }
const act = (fn) => serial(fn).then(queue);
// Opening something from the floating window hands keyboard focus back to the page.
const open = (fn) => act(async () => { await fn(); if (docked) await chrome.windows.update(winId, { focused: true }).catch(() => {}); });

async function load() {
  spaces = await core.syncSpaces(winId);
  active = await core.getActive(winId, spaces);
  favFolder = (await core.folders()).favs;
  [tabs, groups, links, settings, favs, pins] = await Promise.all([
    chrome.tabs.query({ windowId: winId }),
    chrome.tabGroups.query({ windowId: winId }),
    core.getLinks(),
    core.getSettings(),
    chrome.bookmarks.getChildren(favFolder),
    chrome.bookmarks.getChildren(active.folderId),
  ]);
  favs = favs.filter((b) => b.url);
  pins = pins.filter((b) => b.url);
  group = groups.find((g) => g.title === active.name);

  // Keep the bookmark -> tab links honest: drop dead tabs, re-attach tabs that match by URL.
  let dirty = false;
  const alive = new Set(tabs.map((t) => t.id));
  for (const k of Object.keys(links)) if (!alive.has(links[k])) { delete links[k]; dirty = true; }
  const used = linkedIds();
  const claim = (b, ok) => {
    if (links[b.id]) return;
    const t = tabs.find((t) => !used.has(t.id) && t.url === b.url && ok(t));
    if (t) { links[b.id] = t.id; used.add(t.id); dirty = true; }
  };
  favs.forEach((b) => claim(b, (t) => t.pinned));
  pins.forEach((b) => claim(b, (t) => group && t.groupId === group.id));
  // Chrome's own pinned tabs show up as Favorites.
  for (const t of tabs) {
    if (t.pinned && !used.has(t.id) && /^https?:/.test(t.url || "")) {
      const b = await chrome.bookmarks.create({ parentId: favFolder, title: t.title, url: t.url });
      favs.push(b);
      links[b.id] = t.id;
      dirty = true;
    }
  }
  if (dirty) await core.saveLinks(links);
}
const saveLinks = () => core.saveLinks(links);

// ---------- render ----------
const SHOW = { showNav: "nav", showUrl: "url", showFavs: "favs", showHead: "head", showNew: "new", showClear: "clear", showDock: "dock", showHints: "hints" };
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function applyLook() {
  const st = settings, root = document.documentElement, b = document.body;
  const hex = core.spaceHex(active);
  const own = st.bgMode === "custom" && /^#[0-9a-f]{6}$/i.test(st.bgColor || "");
  // Your own colour: text turns light or dark to stay readable on it.
  const isDark = own ? lum(st.bgColor) < 0.45 : st.theme === "dark" || (st.theme === "auto" && sysDark.matches);
  const base = isDark ? "#1b1a1f" : "#ffffff";
  const t = isDark ? st.tint * 0.6 : st.tint;
  const mix = (p) => `color-mix(in srgb, ${hex} ${Math.max(0, Math.min(100, p))}%, ${base})`;
  root.classList.toggle("dark", isDark);
  for (const [k, v] of Object.entries({
    "--bg": own ? st.bgColor : mix(t), "--bg2": own ? `color-mix(in srgb, ${st.bgColor} 82%, ${isDark ? "#000" : "#fff"})` : mix(t * 0.4), "--accent": hex,
    "--fs": st.fontSize + "px", "--row": st.rowHeight + "px", "--fav": st.favSize + "px",
    "--r": st.radius + "px", "--pad": st.pad + "px",
  })) root.style.setProperty(k, v);
  b.classList.toggle("gradient", st.background === "gradient");
  for (const [k, name] of Object.entries(SHOW)) b.classList.toggle("hide-" + name, !st[k]);
  b.dataset.dock = st.dockStyle;
}

// Redraw a section only when what it shows changed. Redrawing on every tab event (many per
// second while pages load) replaced rows mid-click, so clicks like "New Tab" were lost.
const shown = {};
function changed(part, data) {
  const key = JSON.stringify(data);
  if (shown[part] === key) return false;
  shown[part] = key;
  return true;
}
const tabKey = (t) => t && [t.id, t.title, t.url, t.pendingUrl, t.favIconUrl, t.active, t.discarded, t.audible, t.mutedInfo?.muted, t.index, t.groupId, t.pinned, t.splitViewId];
const spaceKey = (s) => [s.id, s.name, s.color, s.hex, s.icon];

function render() {
  applyLook();
  if (!$("#lib").hidden && libView === "spaces") drawLib(); // downloads and closed tabs redraw on their own events
  renderTop();
  renderFavs();
  renderSpace();
  renderDock();
  updateMore();
}

function renderTop() {
  const cur = tabs.find((t) => t.active);
  prettyUrl($("#urltext"), cur?.url || cur?.pendingUrl);
  $("#copy").disabled = !cur?.url;
}

function renderFavs() {
  if (!changed("favs", favs.map((b) => [b.id, b.title, b.url, tabKey(tabById(links[b.id]))]))) return;
  const box = $("#favs");
  box.classList.toggle("empty", !favs.length);
  box.replaceChildren(...favs.map((b) => {
    const t = tabById(links[b.id]);
    const tile = el("button", "tile" + (t ? " open" : "") + (t?.active ? " on" : ""));
    tile.title = b.title || b.url;
    tile.append(favicon(t?.favIconUrl, b.url, b.title));
    tile.onclick = () => open(() => openFav(b));
    tile.oncontextmenu = (e) => menu(e, favMenu(b, t));
    draggable(tile, { kind: "fav", id: b.id });
    dropZone(tile, (d) => dropOnFavs(d, b.index));
    return tile;
  }));
}

function row({ title, url, icon, tab, faded, on }) {
  const r = el("div", "row" + (on ? " on" : "") + (faded ? " faded" : ""));
  r.title = [title, url].filter(Boolean).join("\n");
  r.append(favicon(icon, url, title), el("span", "label", title || host(url) || "New Tab"));
  if (tab && (tab.audible || tab.mutedInfo?.muted)) {
    const m = iconBtn(tab.mutedInfo?.muted ? "muted" : "sound", "Mute / unmute", () =>
      chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }));
    m.classList.add("keep");
    r.append(m);
  }
  r.onauxclick = (e) => { if (e.button === 1 && tab) act(() => chrome.tabs.remove(tab.id)); };
  return r;
}

function renderSpace() {
  const used = linkedIds();
  if (!changed("space", [spaceKey(active), settings.showHints, group?.id,
    pins.map((b) => [b.id, b.title, b.url, tabKey(tabById(links[b.id]))]),
    tabs.filter((t) => group && t.groupId === group.id && !used.has(t.id)).map(tabKey)])) return;
  $("#spacename").textContent = active.name.replace(EMOJI, "").trim() || active.name;
  $("#spacebadge").replaceWith(badge(active, "spacebadge"));
  $("#spacehead").oncontextmenu = (e) => menu(e, spaceMenu(active));

  const pinBox = $("#pins");
  const pinRows = pins.map((b) => {
    const t = tabById(links[b.id]);
    const r = row({ title: b.title || t?.title, url: t?.url || b.url, icon: t?.favIconUrl, tab: t, faded: !t || t.discarded, on: t?.active });
    if (t) r.append(iconBtn("minus", "Close (stays pinned)", () => chrome.tabs.remove(t.id)));
    r.onclick = () => open(() => openPin(b));
    r.ondblclick = () => act(() => renamePin(b));
    r.oncontextmenu = (e) => menu(e, pinMenu(b, t));
    draggable(r, { kind: "pin", id: b.id });
    dropZone(r, (d) => dropOnPins(d, b.index));
    return r;
  });
  pinBox.replaceChildren(...pinRows);
  if (!pins.length) pinBox.append(el("div", "hint", "Drag a tab here to pin it"));

  const openTabs = group ? tabs.filter((t) => t.groupId === group.id && !used.has(t.id)) : [];
  $("#clear").style.display = openTabs.length ? "" : "none";

  const add = row({ title: "New Tab" });
  add.classList.add("new");
  add.querySelector(".fi").innerHTML = svg("plus");
  add.onclick = () => open(() => core.openInSpace(active, winId));

  // Two tabs in a Chrome split view show as one row with two halves, like Arc.
  const done = new Set();
  const items = [];
  for (const t of openTabs) {
    if (done.has(t.id)) continue;
    const mate = inSplit(t) && openTabs.find((x) => x.id !== t.id && x.splitViewId === t.splitViewId);
    if (mate) { done.add(mate.id); items.push(splitRow(t, mate)); } else items.push(t);
  }
  $("#today").replaceChildren(add, ...items.map((t) => {
    if (t instanceof Node) return t;
    const r = row({ title: t.title, url: t.url || t.pendingUrl, icon: t.favIconUrl, tab: t, faded: t.discarded, on: t.active });
    r.append(iconBtn("x", "Close tab", () => chrome.tabs.remove(t.id)));
    r.onclick = () => open(() => chrome.tabs.update(t.id, { active: true }));
    r.oncontextmenu = (e) => menu(e, tabMenu(t));
    draggable(r, { kind: "tab", id: t.id });
    tabDrop(r, t);
    return r;
  }));
}

// ---------- split view (Chrome 155+) ----------
const NONE = chrome.tabs.SPLIT_VIEW_ID_NONE ?? -1;
const canSplit = typeof chrome.tabs.createSplit === "function";
const inSplit = (t) => t.splitViewId != null && t.splitViewId !== NONE;

function splitRow(a, b) {
  const r = el("div", "row split" + (a.active || b.active ? " on" : ""));
  for (const t of [a, b]) {
    const h = el("div", "half" + (t.active ? " on" : "") + (t.discarded ? " faded" : ""));
    h.title = [t.title, t.url].filter(Boolean).join("\n");
    h.append(favicon(t.favIconUrl, t.url, t.title), el("span", "label", t.title || host(t.url) || "New Tab"));
    h.onclick = (e) => { e.stopPropagation(); open(() => chrome.tabs.update(t.id, { active: true })); };
    h.onauxclick = (e) => { if (e.button === 1) act(() => chrome.tabs.remove(t.id)); };
    r.append(h);
  }
  r.oncontextmenu = (e) => menu(e, splitMenu(a, b));
  dropZone(r, (d) => dropOnToday(d, b));
  return r;
}
function splitMenu(a, b) {
  const short = (t) => (t.title || host(t.url) || "tab").slice(0, 28);
  return [
    { label: "Separate tabs", run: () => chrome.tabs.unsplit(a.splitViewId) },
    { label: "Swap sides", run: async () => { const id = a.splitViewId; await chrome.tabs.unsplit(id); await chrome.tabs.move(b.id, { index: a.index }); await chrome.tabs.createSplit([b.id, a.id]); } },
    "-",
    { label: "Copy both links", run: () => copy(`${a.url}\n${b.url}`) },
    "-",
    { label: `Close “${short(a)}”`, run: () => chrome.tabs.remove(a.id) },
    { label: `Close “${short(b)}”`, run: () => chrome.tabs.remove(b.id) },
    { label: "Close both", danger: true, run: () => chrome.tabs.remove([a.id, b.id]) },
  ];
}
// Put tab b beside tab a and join them. Chrome needs them next to each other, in the same group.
async function splitWith(a, b) {
  if (b.pinned) await chrome.tabs.update(b.id, { pinned: false });
  if (b.groupId !== a.groupId) await core.addToSpace([b.id], active, winId);
  const [fa, fb] = await Promise.all([chrome.tabs.get(a.id), chrome.tabs.get(b.id)]);
  if (Math.abs(fa.index - fb.index) !== 1) await chrome.tabs.move(fb.id, { index: fb.index < fa.index ? fa.index : fa.index + 1 });
  await chrome.tabs.createSplit([a.id, b.id]);
  await chrome.tabs.update(a.id, { active: true });
}
const trySplit = (fn) => async () => { try { await fn(); } catch (e) { toast("Couldn't split: " + (e.message || e)); } };

function renderDock() {
  if (!changed("dock", [active.id, settings.dockStyle, spaces.map(spaceKey)])) return;
  $("#chips").replaceChildren(...spaces.map((s) => {
    const c = el("button", "chip" + (s.id === active.id ? " on" : ""));
    c.title = s.name;
    // Auto (Arc): the space you're in shows its icon, the rest are dots.
    const asDot = settings.dockStyle === "dots" || (settings.dockStyle === "auto" && s.id !== active.id);
    if (asDot) {
      const d = el("span", "dot");
      d.style.setProperty("--c", core.spaceHex(s));
      c.append(d);
    } else c.append(badge(s));
    c.onclick = () => go(s);
    c.oncontextmenu = (e) => menu(e, spaceMenu(s));
    draggable(c, { kind: "space", id: s.id });
    dropZone(c, (d) => dropOnSpace(d, s), null, true);
    return c;
  }));
  const chips = $("#chips");
  chips.classList.remove("scrolls");
  chips.classList.toggle("scrolls", chips.scrollWidth > chips.clientWidth + 1);
  chips.querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// A space's icon: the one set in Customize, else an emoji the name starts with, else its initials.
const EMOJI = /^\p{Extended_Pictographic}\uFE0F?/u;
const iconOf = (space) => space.icon || space.name.match(EMOJI)?.[0];
function badge(space, id) {
  const icon = iconOf(space);
  const words = space.name.replace(EMOJI, "").trim().split(/\s+/).filter(Boolean);
  const b = el("span", "badge" + (icon ? " emoji" : ""), icon || (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 1)).toUpperCase());
  if (id) b.id = id;
  b.style.setProperty("--c", core.spaceHex(space));
  return b;
}

// ---------- actions ----------
function go(space, dir) {
  if (space.id === active.id) return;
  const main = $("#main");
  const d = dir ?? Math.sign(spaces.indexOf(space) - spaces.indexOf(active));
  main.classList.remove("slide-l", "slide-r");
  void main.offsetWidth;
  main.classList.add(d > 0 ? "slide-l" : "slide-r");
  act(() => core.switchSpace(winId, space));
}

async function openFav(b) {
  const t = tabById(links[b.id]);
  if (t) return chrome.tabs.update(t.id, { active: true });
  const nt = await chrome.tabs.create({ windowId: winId, url: b.url, pinned: true, active: true });
  links[b.id] = nt.id;
  await saveLinks();
}

async function openPin(b, space = active) {
  const t = tabById(links[b.id]);
  if (t) return chrome.tabs.update(t.id, { active: true });
  const nt = await core.openInSpace(space, winId, b.url);
  links[b.id] = nt.id;
  await saveLinks();
}

async function pinTab(t, index) {
  if (t.pinned) await chrome.tabs.update(t.id, { pinned: false });
  const old = linkOf(t.id);
  if (old) { await chrome.bookmarks.remove(old).catch(() => {}); delete links[old]; }
  const b = await chrome.bookmarks.create({ parentId: active.folderId, title: t.title, url: t.url, index });
  links[b.id] = t.id;
  if (!group || t.groupId !== group.id) await core.addToSpace([t.id], active, winId);
  await saveLinks();
}

async function favTab(t, index) {
  const old = linkOf(t.id);
  if (old) { await chrome.bookmarks.remove(old).catch(() => {}); delete links[old]; }
  const b = await chrome.bookmarks.create({ parentId: favFolder, title: t.title, url: t.url, index });
  links[b.id] = t.id;
  await chrome.tabs.update(t.id, { pinned: true });
  await saveLinks();
}

// Remove a pin/favorite but keep its tab open in this space.
async function release(b) {
  const t = tabById(links[b.id]);
  await chrome.bookmarks.remove(b.id);
  delete links[b.id];
  if (t) {
    if (t.pinned) await chrome.tabs.update(t.id, { pinned: false });
    await core.addToSpace([t.id], active, winId);
  }
  await saveLinks();
}

// Move a pin or favorite to another list; an open tab follows it.
async function convert(b, toFav, index) {
  const t = tabById(links[b.id]);
  if (t) return toFav ? favTab(t, index) : pinTab(t, index);
  await chrome.bookmarks.move(b.id, { parentId: toFav ? favFolder : active.folderId, index });
}

async function renamePin(b) {
  const name = await ask("Rename", "Name", b.title);
  if (name) await chrome.bookmarks.update(b.id, { title: name });
}

async function moveTabToSpace(t, space) {
  const old = linkOf(t.id);
  if (old) { delete links[old]; await saveLinks(); }
  if (t.pinned) await chrome.tabs.update(t.id, { pinned: false });
  await core.addToSpace([t.id], space, winId);
}

async function newSpace() {
  let name = await ask("New space", "Name (tip: start with an emoji 🚀)", "");
  if (!name) return;
  while (spaces.some((s) => s.name === name)) name += " 2";
  const { root } = await core.folders();
  const f = await chrome.bookmarks.create({ parentId: root, title: name });
  const s = { id: crypto.randomUUID(), name, color: core.pickColor(spaces), folderId: f.id };
  spaces.push(s);
  await core.saveSpaces(spaces);
  await core.switchSpace(winId, s);
}

async function renameSpace(s) {
  await core.renameSpace(s.id, await ask("Rename space", "Name", s.name));
}

async function sleepSpace(s) {
  const g = await core.groupOf(s, winId);
  if (!g) return;
  for (const t of tabs) if (t.groupId === g.id && !t.active && !t.audible) chrome.tabs.discard(t.id).catch(() => {});
  toast("Tabs put to sleep");
}

async function deleteSpace(s) {
  if (spaces.length < 2) return toast("You need at least one space");
  const ok = await confirmBox(`Delete “${s.name}”?`, "Its pinned tabs are removed and its open tabs are closed.", "Delete");
  if (!ok) return;
  const g = await core.groupOf(s, winId);
  if (s.id === active.id) await core.switchSpace(winId, spaces.find((x) => x.id !== s.id));
  if (g) await chrome.tabs.remove(tabs.filter((t) => t.groupId === g.id).map((t) => t.id));
  await chrome.bookmarks.removeTree(s.folderId).catch(() => {});
  spaces = spaces.filter((x) => x.id !== s.id);
  await core.saveSpaces(spaces);
}

// ---------- drag and drop ----------
let drag = null;
function draggable(node, data) {
  node.draggable = true;
  node.addEventListener("dragstart", (e) => {
    drag = data;
    e.dataTransfer.effectAllowed = "move";
    node.classList.add("dragsrc");
    document.body.classList.add("dragging");
  });
  node.addEventListener("dragend", () => {
    drag = null;
    node.classList.remove("dragsrc");
    document.body.classList.remove("dragging");
    document.querySelectorAll(".over, .splitover").forEach((n) => n.classList.remove("over", "splitover"));
  });
}
// Only space chips (anySpace) accept a dragged space; everything else ignores it.
function dropZone(node, onDrop, hover, anySpace) {
  node.addEventListener("dragover", (e) => {
    if (!drag || (drag.kind === "space" && !anySpace)) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(".over").forEach((n) => n !== node && n.classList.remove("over", "splitover"));
    node.classList.add("over");
    hover?.(e);
  });
  node.addEventListener("dragleave", (e) => { if (!node.contains(e.relatedTarget)) node.classList.remove("over", "splitover"); });
  node.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    node.classList.remove("over", "splitover");
    const d = drag;
    drag = null;
    document.body.classList.remove("dragging");
    if (d && (d.kind !== "space" || anySpace)) act(() => onDrop(d, e));
  });
}

// Tab rows: drop near the top edge to move the tab there; drop on the rest of the row to split, like Arc.
function tabDrop(r, t) {
  const splitHere = (d, e) => {
    const src = d?.kind === "tab" && tabById(d.id);
    if (!canSplit || !src || src.id === t.id || src.pinned || inSplit(src) || inSplit(t)) return false;
    const b = r.getBoundingClientRect();
    return e.clientY - b.top > b.height * 0.3;
  };
  dropZone(r,
    (d, e) => (splitHere(d, e) ? splitWith(t, tabById(d.id)).catch((x) => toast("Couldn't split: " + (x.message || x))) : dropOnToday(d, t)),
    (e) => r.classList.toggle("splitover", splitHere(drag, e)));
}

async function dropOnFavs(d, index) {
  if (d.kind === "tab") return favTab(tabById(d.id), index);
  const b = bmById(d.id);
  if (d.kind === "pin") return convert(b, true, index);
  if (d.kind === "fav" && index != null) return chrome.bookmarks.move(b.id, { parentId: favFolder, index });
}
async function dropOnPins(d, index) {
  if (d.kind === "tab") return pinTab(tabById(d.id), index);
  const b = bmById(d.id);
  if (d.kind === "fav") return convert(b, false, index);
  if (d.kind === "pin") return chrome.bookmarks.move(b.id, { parentId: active.folderId, index });
}
async function dropOnToday(d, target) {
  if (d.kind !== "tab") return release(bmById(d.id));
  const t = tabById(d.id);
  if (!target || t.id === target.id) return group && t.groupId !== group.id && core.addToSpace([t.id], active, winId);
  await chrome.tabs.move(t.id, { index: target.index });
  await core.addToSpace([t.id], active, winId);
}
async function dropOnSpace(d, s) {
  if (d.kind === "space") return core.placeSpace(d.id, spaces.findIndex((x) => x.id === s.id));
  if (d.kind === "tab") return moveTabToSpace(tabById(d.id), s);
  const b = bmById(d.id);
  const t = tabById(links[b.id]);
  await chrome.bookmarks.move(b.id, { parentId: s.folderId });
  if (t) {
    if (t.pinned) await chrome.tabs.update(t.id, { pinned: false });
    await core.addToSpace([t.id], s, winId);
  }
}

// ---------- context menus ----------
function menu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  const m = $("#menu");
  m.replaceChildren(...items.filter(Boolean).map((it) => {
    if (it === "-") return el("hr");
    if (it.head) return el("div", "mhead", it.head);
    const b = el("button", it.danger ? "danger" : "");
    if (it.dot) { const d = el("span", "d"); d.style.background = it.dot; b.append(d); }
    if (it.check != null) b.append(el("span", "check", it.check ? "✓" : ""));
    b.append(el("span", "ml", it.label));
    b.title = it.label;
    b.onclick = () => { hideMenu(); act(it.run); };
    return b;
  }));
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(6, Math.min(e.clientX, innerWidth - r.width - 6)) + "px";
  m.style.top = Math.max(6, Math.min(e.clientY, innerHeight - r.height - 6)) + "px";
}
function hideMenu() { $("#menu").hidden = true; }
addEventListener("click", (e) => { if (!$("#menu").contains(e.target)) hideMenu(); });
addEventListener("blur", hideMenu);

const spaceTargets = (fn) => {
  const others = spaces.filter((s) => s.id !== active.id);
  return others.length ? [{ head: "Move to space" }, ...others.map((s) => ({ label: s.name, dot: core.spaceHex(s), run: () => fn(s) }))] : [];
};

function tabMenu(t) {
  const others = canSplit && !inSplit(t) && !t.pinned
    ? tabs.filter((x) => x.id !== t.id && group && x.groupId === group.id && !inSplit(x) && !linkedIds().has(x.id)).slice(0, 8) : [];
  return [
    canSplit && !inSplit(t) && !t.pinned && { label: "Split with new tab", run: trySplit(async () => {
      const nt = await chrome.tabs.create({ splitWithTabId: t.id, windowId: winId });
      if (group && nt.groupId !== group.id) await core.addToSpace([nt.id], active, winId).catch(() => {});
    }) },
    others.length && { head: "Split view with" },
    ...others.map((x) => ({ label: (x.title || host(x.url) || "Tab").slice(0, 40), run: trySplit(() => splitWith(t, x)) })),
    inSplit(t) && { label: "Separate split view", run: () => chrome.tabs.unsplit(t.splitViewId) },
    (canSplit && !t.pinned) && "-",
    { label: `Pin to “${active.name}”`, run: () => pinTab(t) },
    { label: "Add to Favorites", run: () => favTab(t) },
    "-",
    ...spaceTargets((s) => moveTabToSpace(t, s)),
    "-",
    { label: "Copy link", run: () => copy(t.url) },
    { label: "Duplicate", run: () => chrome.tabs.duplicate(t.id) },
    { label: "Put to sleep", run: () => chrome.tabs.discard(t.id).catch(() => toast("Can't sleep the current tab")) },
    "-",
    { label: "Close tab", danger: true, run: () => chrome.tabs.remove(t.id) },
  ];
}
function pinMenu(b, t) {
  return [
    { label: "Rename", run: () => renamePin(b) },
    t && t.url !== b.url && { label: "Go back to pinned page", run: () => chrome.tabs.update(t.id, { url: b.url }) },
    t && { label: "Save current page as pin", run: () => chrome.bookmarks.update(b.id, { url: t.url }) },
    { label: "Copy link", run: () => copy(t?.url || b.url) },
    "-",
    { label: "Move to Favorites", run: () => convert(b, true) },
    ...spaceTargets((s) => dropOnSpace({ kind: "pin", id: b.id }, s)),
    "-",
    t && { label: "Close tab (keep pin)", run: () => chrome.tabs.remove(t.id) },
    { label: "Unpin", danger: true, run: () => release(b) },
  ];
}
function favMenu(b, t) {
  return [
    { label: "Rename", run: () => renamePin(b) },
    { label: "Copy link", run: () => copy(t?.url || b.url) },
    { label: `Move to “${active.name}” pins`, run: () => convert(b, false) },
    "-",
    t && { label: "Close tab (keep favorite)", run: () => chrome.tabs.remove(t.id) },
    { label: "Remove from Favorites", danger: true, run: () => release(b) },
  ];
}
function spaceMenu(s) {
  return [
    s.id !== active.id && { label: "Open space", run: () => go(s) },
    { label: "Rename", run: () => renameSpace(s) },
    spaces[0] !== s && { label: "Move left", run: () => core.moveSpace(s.id, -1) },
    spaces.at(-1) !== s && { label: "Move right", run: () => core.moveSpace(s.id, 1) },
    { head: "Colour" },
    ...COLOR_NAMES.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), dot: COLORS[c].dot, check: !s.hex && s.color === c, run: () => core.recolorSpace(s.id, c) })),
    { label: "Icon, custom colour…", run: customize },
    "-",
    { label: "Put open tabs to sleep", run: () => sleepSpace(s) },
    s.id === active.id && { label: "Close all open tabs", run: () => clearToday() },
    "-",
    { label: "Library…", run: () => openLib() },
    { label: "Delete space", danger: true, run: () => deleteSpace(s) },
  ];
}
const customize = () => chrome.runtime.openOptionsPage();
async function clearToday() {
  const used = linkedIds();
  const ids = group ? tabs.filter((t) => t.groupId === group.id && !used.has(t.id)).map((t) => t.id) : [];
  if (ids.length) await chrome.tabs.remove(ids);
}

// ---------- "more below" button (Arc's floating ↓) ----------
function updateMore() {
  const m = $("#main");
  $("#more").hidden = !$("#lib").hidden || m.scrollTop + m.clientHeight >= m.scrollHeight - 8;
}

// ---------- Library: downloads, archived (recently closed) tabs, spaces ----------
const LIB = [
  ["downloads", "Downloads", "download"],
  ["archive", "Archived Tabs", "box"],
  ["spaces", "Spaces", "stack"],
  ["customize", "Customize", "sliders"],
];
let libView = "downloads";
function openLib(view = libView) {
  hideMenu();
  libView = view;
  document.body.classList.add("lib");
  $("#lib").hidden = false;
  $("#libq").value = "";
  drawLib();
  updateMore();
}
function closeLib() {
  document.body.classList.remove("lib");
  $("#lib").hidden = true;
  updateMore();
}

function ago(ms) {
  const day = (d) => new Date(d).setHours(0, 0, 0, 0);
  const n = Math.round((day(Date.now()) - day(ms)) / 864e5);
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}
const KINDS = [[/\.pdf$/i, "PDF"], [/\.(png|jpe?g|gif|webp|avif|svg|heic|bmp)$/i, "Image"], [/\.(mp3|m4a|ogg|opus|wav|flac|aac)$/i, "Audio"],
  [/\.(mp4|mov|webm|mkv|avi)$/i, "Video"], [/\.(zip|rar|7z|tar|gz|dmg|pkg)$/i, "Archive"]];
const kindOf = (name) => KINDS.find(([re]) => re.test(name))?.[1] || "Download";
const fileIcons = new Map();

function litem({ icon, title, sub, faded, run, onmenu }) {
  const n = el("button", "litem" + (faded ? " faded" : ""));
  n.title = [title, sub].filter(Boolean).join("\n");
  const t = el("span", "ltext");
  t.append(el("span", "label", title), el("span", "sub", sub));
  n.append(icon, t);
  n.onclick = run;
  if (onmenu) n.oncontextmenu = (e) => menu(e, onmenu());
  return n;
}
function grouped(items, when) {
  const out = [];
  let last;
  for (const it of items) {
    const h = ago(when(it));
    if (h !== last) { out.push(el("div", "lhead", h)); last = h; }
    out.push(it.node);
  }
  return out;
}

let libToken = 0;
async function drawLib() {
  const my = ++libToken;
  $("#libnav").replaceChildren(...LIB.map(([id, label, ic]) => {
    const b = el("button", "lnav" + (id === libView ? " on" : ""));
    b.innerHTML = svg(ic);
    b.append(el("span", null, label));
    b.title = label;
    b.onclick = () => (id === "customize" ? customize() : openLib(id));
    return b;
  }), Object.assign(iconBtn("left", "Back to tabs", closeLib), { id: "libback" }));

  const q = $("#libq").value.trim().toLowerCase();
  const hit = (...x) => !q || x.some((v) => (v || "").toLowerCase().includes(q));
  $("#libq").placeholder = "Search " + LIB.find(([id]) => id === libView)[1];
  let nodes = [];

  if (libView === "downloads") {
    const list = (await chrome.downloads.search({ orderBy: ["-startTime"], limit: 300 }))
      .map((d) => ({ ...d, name: d.filename.split(/[\\/]/).pop() || d.url }))
      .filter((d) => hit(d.name, d.finalUrl || d.url));
    for (const d of list) {
      const icon = el("span", "fi file");
      if (!fileIcons.has(d.id)) fileIcons.set(d.id, chrome.downloads.getFileIcon(d.id, { size: 32 }).catch(() => null));
      fileIcons.get(d.id).then((src) => { if (src) icon.append(Object.assign(el("img"), { src })); else icon.innerHTML = svg("download"); });
      const from = host(d.referrer || d.finalUrl || d.url);
      const sub = d.state === "in_progress" ? `${d.totalBytes > 0 ? Math.round((100 * d.bytesReceived) / d.totalBytes) : 0}% · ${from}`
        : !d.exists ? "Deleted" : d.state === "interrupted" ? "Failed" : `${kindOf(d.name)}${from ? " from " + from : ""}`;
      d.node = litem({
        icon, title: d.name, sub, faded: !d.exists || d.state === "interrupted",
        // runs straight from the click, which Chrome requires for opening files
        run: () => (d.exists && d.state === "complete" ? chrome.downloads.open(d.id) : chrome.downloads.show(d.id)),
        onmenu: () => [
          d.exists && { label: "Show in Finder", run: () => chrome.downloads.show(d.id) },
          { label: "Copy download link", run: () => copy(d.finalUrl || d.url) },
          "-",
          { label: "Remove from list", danger: true, run: () => chrome.downloads.erase({ id: d.id }) },
        ],
      });
    }
    nodes = grouped(list, (d) => Date.parse(d.startTime));
    if (!list.length) nodes = [el("div", "lempty", q ? "No downloads match." : "Files you download show up here.")];
  }

  if (libView === "archive") {
    const list = [];
    for (const s of await chrome.sessions.getRecentlyClosed({ maxResults: 25 })) {
      const at = (s.lastModified || 0) * 1000;
      if (s.tab && hit(s.tab.title, s.tab.url)) {
        const t = s.tab;
        list.push({ at, node: litem({ icon: favicon(t.favIconUrl, t.url, t.title), title: t.title || t.url, sub: host(t.url),
          run: () => open(() => chrome.sessions.restore(t.sessionId)) }) });
      } else if (s.window && hit(...s.window.tabs.map((t) => t.title))) {
        list.push({ at, node: litem({ icon: Object.assign(el("span", "fi"), { innerHTML: svg("stack") }), title: `Window with ${s.window.tabs.length} tabs`,
          sub: s.window.tabs.map((t) => t.title).slice(0, 3).join(", "), run: () => open(() => chrome.sessions.restore(s.window.sessionId)) }) });
      }
    }
    nodes = grouped(list, (x) => x.at);
    if (!list.length) nodes = [el("div", "lempty", q ? "No closed tabs match." : "Tabs you close show up here, so you can bring them back.")];
  }

  if (libView === "spaces") {
    nodes = spaces.filter((s) => hit(s.name)).map((s) => {
      const g = groups.find((x) => x.title === s.name);
      const n = g ? tabs.filter((t) => t.groupId === g.id).length : 0;
      const node = litem({ icon: badge(s), title: s.name, sub: n ? `${n} open tab${n > 1 ? "s" : ""}` : "No open tabs",
        run: () => { closeLib(); go(s); }, onmenu: () => spaceMenu(s) });
      if (s.id === active.id) node.classList.add("on");
      return node;
    });
  }
  if (my === libToken) $("#liblist").replaceChildren(...nodes);
}
for (const ev of [chrome.downloads?.onCreated, chrome.downloads?.onChanged, chrome.downloads?.onErased, chrome.sessions?.onChanged]) {
  ev?.addListener(() => { if (!$("#lib").hidden) drawLib(); });
}

// ---------- dialogs ----------
function dialog(build) {
  return new Promise((resolve) => {
    const d = $("#dialog");
    const card = el("div", "card");
    const done = (v) => { d.hidden = true; d.replaceChildren(); resolve(v); };
    build(card, done);
    d.replaceChildren(card);
    d.hidden = false;
    d.onclick = (e) => { if (e.target === d) done(null); };
    card.querySelector("input, .ok")?.focus();
  });
}
function buttons(card, done, okLabel, danger, value) {
  const row = el("div", "btns");
  const cancel = el("button", null, "Cancel");
  const ok = el("button", "ok" + (danger ? " danger" : ""), okLabel);
  cancel.onclick = () => done(null);
  ok.onclick = () => done(value());
  row.append(cancel, ok);
  card.append(row);
  card.onkeydown = (e) => { if (e.key === "Escape") done(null); if (e.key === "Enter") done(value()); };
}
const ask = (title, placeholder, value) => dialog((card, done) => {
  const input = el("input");
  input.placeholder = placeholder;
  input.value = value || "";
  card.append(el("h3", null, title), input);
  buttons(card, done, "Save", false, () => input.value.trim() || null);
  setTimeout(() => input.select());
});
const confirmBox = (title, text, okLabel) => dialog((card, done) => {
  card.append(el("h3", null, title), el("p", null, text));
  buttons(card, done, okLabel, true, () => true);
});

// ---------- command bar ----------
const pal = $("#palette"), pq = $("#pq"), pres = $("#presults");
let results = [], sel = 0;

function openPalette() {
  hideMenu();
  pal.hidden = false;
  const cur = tabs.find((t) => t.active);
  pq.value = cur?.url && !/^chrome:/.test(cur.url) ? cur.url : "";
  pq.focus();
  pq.select();
  search("");
}
function closePalette() { pal.hidden = true; }

let searchToken = 0;
async function search(raw) {
  const my = ++searchToken;
  const q = raw.trim().toLowerCase();
  const m = (...s) => !q || s.some((x) => (x || "").toLowerCase().includes(q));
  const items = [];
  const gname = (id) => groups.find((g) => g.id === id)?.title;
  for (const t of tabs) {
    if (m(t.title, t.url)) items.push({ title: t.title, sub: t.pinned ? "Favorite" : gname(t.groupId) || "Tab", url: t.url, icon: t.favIconUrl, run: () => chrome.tabs.update(t.id, { active: true }) });
  }
  const { root } = await core.folders();
  const linked = new Set(Object.keys(links));
  for (const folder of (await chrome.bookmarks.getSubTree(root))[0].children || []) {
    const space = spaces.find((s) => s.folderId === folder.id);
    for (const b of folder.children || []) {
      if (!b.url || linked.has(b.id) || !m(b.title, b.url)) continue;
      items.push({ title: b.title, sub: space ? `Pinned · ${space.name}` : "Favorite", url: b.url,
        run: () => space ? openPin(b, space).then(() => core.setActive(winId, space.id)) : openFav(b) });
    }
  }
  if (q) {
    const isUrl = /^[a-z]+:\/\//.test(q) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q) || /^localhost(:\d+)?/.test(q);
    const text = raw.trim();
    const first = isUrl
      ? { title: text, sub: "Open", url: "", glyph: "globe", run: () => core.openInSpace(active, winId, /^[a-z]+:\/\//.test(text) ? text : "https://" + text) }
      : { title: text, sub: "Search", glyph: "search", run: () => chrome.search.query({ text, disposition: "NEW_TAB" }) };
    items.splice(isUrl ? 0 : Math.min(items.length, 3), 0, first);
    if (q.length > 1) {
      const seen = new Set(items.map((i) => i.url));
      for (const b of (await chrome.bookmarks.search(q)).slice(0, 25)) {
        if (b.url && !seen.has(b.url)) items.push({ title: b.title, sub: "Bookmark", url: b.url, run: () => core.openInSpace(active, winId, b.url) });
      }
    }
  }
  if (my !== searchToken) return; // a newer search started meanwhile
  results = items.slice(0, 50);
  sel = 0;
  drawResults();
}
function drawResults() {
  pres.replaceChildren(...results.map((r, i) => {
    const n = el("div", "res" + (i === sel ? " sel" : ""));
    const ic = r.glyph ? Object.assign(el("span", "fi"), { innerHTML: svg(r.glyph) }) : favicon(r.icon, r.url, r.title);
    n.append(ic, el("span", "label", r.title || r.url), el("span", "sub", r.sub));
    n.onmousemove = () => { if (sel !== i) { sel = i; drawResults(); } };
    n.onclick = () => runResult(i);
    return n;
  }));
  pres.children[sel]?.scrollIntoView({ block: "nearest" });
}
function runResult(i) {
  const r = results[i];
  closePalette();
  if (r) open(r.run);
}
pq.addEventListener("input", () => search(pq.value));
pq.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, results.length - 1); drawResults(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); drawResults(); e.preventDefault(); }
  else if (e.key === "Enter") runResult(sel);
  else if (e.key === "Escape") closePalette();
});
pal.addEventListener("mousedown", (e) => { if (e.target === pal) closePalette(); });

// ---------- wiring ----------
for (const [id, name] of [["back", "back"], ["fwd", "fwd"], ["reload", "reload"], ["copy", "link"], ["spacemenu", "more"], ["library", "box"], ["addspace", "plus"]]) {
  $("#" + id).innerHTML = svg(name);
}
$("#psearch").innerHTML = svg("search");
const cur = () => tabs.find((t) => t.active);
$("#back").onclick = () => cur() && chrome.tabs.goBack(cur().id).catch(() => {});
$("#fwd").onclick = () => cur() && chrome.tabs.goForward(cur().id).catch(() => {});
$("#reload").onclick = () => cur() && chrome.tabs.reload(cur().id);
$("#copy").onclick = (e) => { e.stopPropagation(); if (cur()?.url) copy(cur().url); };
$("#url").onclick = openPalette;
$("#url").onkeydown = (e) => { if (e.key === "Enter") openPalette(); };
$("#spacemenu").onclick = (e) => menu(e, spaceMenu(active));
$("#spacename").ondblclick = () => act(() => renameSpace(active));
$("#library").onclick = () => ($("#lib").hidden ? openLib() : closeLib());
$("#more").innerHTML = svg("down");
$("#more").onclick = () => $("#main").scrollBy({ top: $("#main").clientHeight * 0.8, behavior: "smooth" });
$("#main").addEventListener("scroll", updateMore, { passive: true });
addEventListener("resize", updateMore);
$("#libsearch").innerHTML = svg("search");
$("#libq").addEventListener("input", () => drawLib());
$("#libq").addEventListener("keydown", (e) => { if (e.key === "Escape") closeLib(); });
$("#addspace").onclick = () => act(newSpace);
$("#clear").onclick = () => act(clearToday);
dropZone($("#favs"), (d) => dropOnFavs(d));
dropZone($("#pins"), (d) => dropOnPins(d));
dropZone($("#today"), (d) => dropOnToday(d, null));

addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
    e.preventDefault();
    openPalette();
  }
  if (!typing && (e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
    const s = spaces[+e.key - 1];
    if (s) { e.preventDefault(); go(s); }
  }
});

// Two-finger horizontal swipe switches spaces.
let swipe = 0, cool = 0;
$("#main").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (Date.now() < cool) return;
  swipe += e.deltaX;
  if (Math.abs(swipe) > 60) {
    const dir = swipe > 0 ? 1 : -1;
    swipe = 0;
    cool = Date.now() + 550;
    const i = spaces.indexOf(active);
    go(spaces[(i + dir + spaces.length) % spaces.length], dir);
  }
}, { passive: false });

for (const ev of [
  chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated, chrome.tabs.onActivated, chrome.tabs.onMoved,
  chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabs.onReplaced,
  chrome.tabGroups.onCreated, chrome.tabGroups.onUpdated, chrome.tabGroups.onRemoved, chrome.tabGroups.onMoved,
  chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged, chrome.bookmarks.onMoved,
  chrome.storage.onChanged,
]) ev?.addListener(queue);
sysDark.addEventListener("change", () => active && render());
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "session" && c.restored?.newValue) toast(`Reopened ${c.restored.newValue.n} tabs from last time`);
});

if (docked) {
  // The floating window follows whichever browser window you used last.
  winId = (await chrome.windows.getLastFocused({ windowTypes: ["normal"] })).id;
  chrome.windows.onFocusChanged.addListener(async (id) => {
    const w = id > 0 && await chrome.windows.get(id).catch(() => null);
    if (w?.type === "normal" && w.id !== winId) { winId = w.id; queue(); }
  });
} else winId = (await chrome.windows.getCurrent()).id;
queue();
