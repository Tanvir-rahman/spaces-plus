import { getSpaces, getActive, setActive, setLastTab, spaceOfGroup, addToSpace, stepSpace, switchSpace, getSettings, saveSettings, sleepWhenReady } from "./core.js";

const session = chrome.storage.session;

// ---------- where the sidebar lives ----------
// "panel": Chrome's own side panel (Chrome decides its minimum width and side).
// "window": a small window docked to the left of the browser window, any width.
async function applyMode() {
  const { mode } = await getSettings();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode !== "window" });
}
applyMode();

// The floating sidebar acts attached: it sits on the browser window's left edge, moves and resizes
// with it, hides when it's minimised or full screen, and jumps to whichever browser window you use.
// ponytail: Chrome can't truly parent one window to another, so this follows bounds events instead.
const getDock = async () => (await session.get("dock")).dock; // { id, main, right }
const setDock = (d) => session.set({ dock: d });
const win = (id) => (id == null ? Promise.resolve(null) : chrome.windows.get(id).catch(() => null));
const alive = async (id) => !!(await win(id));
const same = (w, b) => Object.keys(b).every((k) => w[k] === b[k]);
// Our own moves fire bounds events too. Ignore those briefly, then check once, so the two windows
// never chase each other (that chase was the flicker).
let quietUntil = 0, settle;
const move = (w, b) => {
  if (same(w, b)) return null;
  quietUntil = Date.now() + 350;
  return chrome.windows.update(w.id, b).catch(() => {});
};
const MAX_W = 520; // widest the sidebar may be (matches Customize)

// Left edge of the screen the window is on, so the sidebar never ends up off-screen.
async function screenLeft(w) {
  const displays = await chrome.system.display.getInfo().catch(() => []);
  const cx = w.left + w.width / 2, cy = w.top + w.height / 2;
  const d = displays.find(({ workArea: a }) => cx >= a.left && cx < a.left + a.width && cy >= a.top && cy < a.top + a.height) || displays[0];
  return d ? d.workArea.left : 0;
}

// Put the sidebar on the browser window's left. No room? Nudge the browser window right.
async function glue() {
  const d = await getDock();
  const [dock, main] = await Promise.all([win(d?.id), win(d?.main)]);
  if (!dock || !main) return;
  if (main.state !== "normal") return move(dock, { state: "minimized" });
  if (dock.state !== "normal") await move(dock, { state: "normal" });
  const min = await screenLeft(main);
  const take = dock.width;
  let left = main.left - take;
  if (left < min) {
    left = min;
    const right = main.left + main.width;
    await move(main, { left: min + take, width: Math.max(400, right - min - take) });
    main.left = min + take;
  }
  d.right = main.left + main.width;
  await setDock(d);
  await move(dock, { left, top: main.top, height: main.height });
}

// User dragged the sidebar's edge: the browser window gives or takes the space, its right edge stays put.
async function fitMain(dock) {
  const d = await getDock();
  const main = await win(d?.main);
  if (!main || main.state !== "normal") return;
  const left = dock.left + dock.width;
  await move(main, { left, top: dock.top, width: Math.max(400, d.right - left), height: dock.height });
}

async function attachTo(mainId) {
  const d = await getDock();
  if (!d || d.main === mainId) return;
  d.main = mainId;
  await setDock(d);
  await glue();
}

async function openDock() {
  const old = await getDock();
  if (old && await alive(old.id)) return chrome.windows.update(old.id, { focused: true });
  const main = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (main.state !== "normal") await chrome.windows.update(main.id, { state: "normal" }); // a full-screen window can't share the screen
  const m = await win(main.id);
  const { dockWidth } = await getSettings();
  const dock = await chrome.windows.create({
    url: "panel.html?dock=1", type: "popup", focused: false,
    left: m.left, top: m.top, width: dockWidth, height: m.height,
  });
  await setDock({ id: dock.id, main: m.id, right: m.left + m.width });
  await chrome.windows.update(m.id, { left: m.left + dock.width, width: Math.max(400, m.width - dock.width), focused: true });
}

async function closeDock() {
  const d = await getDock();
  if (d && await alive(d.id)) await chrome.windows.remove(d.id); // onRemoved gives the space back
}

chrome.windows.onBoundsChanged.addListener(async (w) => {
  const d = await getDock();
  if (!d || (w.id !== d.main && w.id !== d.id)) return;
  if (Date.now() < quietUntil) { // echo of our own move: re-check once things settle
    clearTimeout(settle);
    settle = setTimeout(glue, quietUntil - Date.now() + 50);
    return;
  }
  if (w.id === d.main) return glue(); // browser window moved or resized: sidebar follows
  const s = await getSettings();
  // Double-clicking the sidebar's title bar makes macOS zoom it to fill the screen. Undo that.
  if (w.state !== "normal" || w.width > MAX_W) {
    quietUntil = Date.now() + 350;
    await chrome.windows.update(w.id, { state: "normal" }).catch(() => {});
    await chrome.windows.update(w.id, { width: s.dockWidth }).catch(() => {});
    return glue();
  }
  if (s.dockWidth !== w.width) await saveSettings({ ...s, dockWidth: w.width });
  await fitMain(w);
});

// Minimise, full screen and switching windows don't always send a bounds event, so check on focus too.
chrome.windows.onFocusChanged.addListener(async (id) => {
  const d = await getDock();
  if (!d) return;
  const w = await win(id);
  if (w?.type === "normal" && w.id !== d.main) return attachTo(w.id);
  await glue();
}, { windowTypes: ["normal", "popup"] });

chrome.windows.onRemoved.addListener(async (id) => {
  const d = await getDock();
  if (!d) return;
  if (id === d.main) { // browser window closed: move to another one, or close
    const next = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
    return next ? attachTo(next.id) : closeDock();
  }
  if (id !== d.id) return;
  await session.remove("dock");
  const m = await win(d.main);
  if (m && m.state === "normal") {
    const { dockWidth } = await getSettings();
    const min = await screenLeft(m);
    const left = Math.max(min, m.left - dockWidth);
    await chrome.windows.update(m.id, { left, width: m.width + (m.left - left) }).catch(() => {});
  }
});

// Floating mode opens the sidebar right after install or update, so you see it without hunting for the button.
chrome.runtime.onInstalled.addListener(async () => {
  if ((await getSettings()).mode === "window") setTimeout(openDock, 500);
});

chrome.action.onClicked.addListener(async () => { // only fires in "window" mode
  const d = await getDock();
  if (d && await alive(d.id)) closeDock(); else openDock();
});

chrome.storage.onChanged.addListener(async (c, area) => {
  if (area !== "local" || !c.settings) return;
  const o = c.settings.oldValue || {}, n = c.settings.newValue || {};
  if (o.mode === n.mode) {
    if (n.mode === "window" && n.dockWidth !== o.dockWidth) { // width typed in Customize
      const d = await getDock();
      const w = d && await chrome.windows.get(d.id).catch(() => null);
      if (w && w.width !== n.dockWidth) await chrome.windows.update(w.id, { width: n.dockWidth });
    }
    return;
  }
  await applyMode();
  if (n.mode === "window") openDock(); else closeDock();
});

// ---------- tabs follow spaces ----------
// New or stray tabs join the space you're in, like Arc.
async function adopt(tab) {
  if (restoring || !tab || tab.pinned || tab.groupId !== -1) return; // already placed, or being restored
  const win = await chrome.windows.get(tab.windowId).catch(() => null);
  if (!win || win.type !== "normal") return;
  const [spaces, settings] = await Promise.all([getSpaces(), getSettings()]);
  if (!spaces.length || !settings.autoGroup) return;
  await addToSpace([tab.id], await getActive(tab.windowId, spaces), tab.windowId).catch(() => {});
}
chrome.tabs.onCreated.addListener((created) => {
  setTimeout(async () => adopt(await chrome.tabs.get(created.id).catch(() => null)), 400);
});

// Clicking a tab in Chrome's tab strip moves you to its space.
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const space = tab && await spaceOfGroup(tab.groupId);
  if (!space) return setTimeout(async () => adopt(await chrome.tabs.get(tabId).catch(() => null)), 400);
  await setLastTab(space.id, tabId);
  await setActive(windowId, space.id);
});

chrome.commands.onCommand.addListener(async (cmd) => {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (cmd === "next-space") stepSpace(win.id, 1);
  if (cmd === "prev-space") stepSpace(win.id, -1);
});

// ---------- backup: every space's open tabs survive Chrome closing ----------
// Spaces Plus keeps a running list of each space's open tabs. If Chrome opens without them
// (startup set to "New Tab page", or the last window was closed), they come back asleep.
const REAL = /^(https?|file):/;
let restoring = false, snapTimer, restoreRun = Promise.resolve();

function snapshotSoon() { clearTimeout(snapTimer); snapTimer = setTimeout(snapshot, 1500); }
async function snapshot() {
  if (restoring) return;
  const [spaces, tabs, groups] = await Promise.all([getSpaces(), chrome.tabs.query({ windowType: "normal" }), chrome.tabGroups.query({})]);
  const title = new Map(groups.map((g) => [g.id, g.title]));
  const out = {};
  let n = 0;
  for (const t of tabs) {
    const url = t.url || t.pendingUrl || "";
    const space = spaces.find((x) => x.name === title.get(t.groupId));
    if (!space || !REAL.test(url)) continue;
    (out[space.id] ||= []).push({ url, title: t.title });
    n++;
  }
  if (!n) return; // nothing open yet (a fresh, empty window): keep the last good backup
  await chrome.storage.local.set({ backup: { at: Date.now(), spaces: out } });
}
for (const ev of [chrome.tabs.onCreated, chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabGroups.onUpdated]) ev.addListener(snapshotSoon);
chrome.tabs.onUpdated.addListener((id, c) => { if (c.url || c.title || "groupId" in c) snapshotSoon(); });
// Tabs closing because their window (or Chrome) is closing must not wipe the backup.
chrome.tabs.onRemoved.addListener((id, info) => { if (!info.isWindowClosing) snapshotSoon(); });

async function restore(winId) {
  const [{ backup }, settings, spaces, tabs] = await Promise.all([
    chrome.storage.local.get("backup"), getSettings(), getSpaces(), chrome.tabs.query({}),
  ]);
  if (!settings.restoreTabs || !backup) return 0;
  // Startup and the first new window can both ask for a restore: only the first one runs.
  const { restoreRan } = await session.get("restoreRan");
  if (restoreRan && Date.now() - restoreRan < 120000) return 0;
  await session.set({ restoreRan: Date.now() });
  const open = new Map(); // url -> how many are open, so nothing is opened twice
  for (const t of tabs) { const u = t.url || t.pendingUrl; open.set(u, (open.get(u) || 0) + 1); }
  let count = 0;
  restoring = true;
  try {
    for (const space of spaces) {
      const missing = (backup.spaces[space.id] || []).filter((b) => {
        const c = open.get(b.url) || 0;
        if (c) open.set(b.url, c - 1);
        return !c;
      });
      if (!missing.length) continue;
      if (winId == null || !await alive(winId)) {
        winId = (await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null))?.id
          ?? (await chrome.windows.create({ focused: true })).id;
      }
      const ids = [];
      for (const b of missing) ids.push((await chrome.tabs.create({ windowId: winId, url: b.url, active: false })).id);
      await addToSpace(ids, space, winId);
      for (const id of ids) sleepWhenReady(id); // asleep until clicked, keeps Chrome light
      count += ids.length;
    }
  } finally { restoring = false; }
  if (count) {
    await session.set({ restored: { n: count, at: Date.now() } });
    await switchSpace(winId, await getActive(winId, await getSpaces())).catch(() => {});
  }
  return count;
}
// One restore at a time; a second one finds everything already open and does nothing.
const restoreSafe = (winId) => (restoreRun = restoreRun.then(() => restore(winId)).catch(console.error));

async function afterRestore() {
  if ((await getSettings()).mode === "window" && !await alive((await getDock())?.id)) openDock();
}

// Chrome just started: give its own session restore a few seconds first.
chrome.runtime.onStartup.addListener(() => {
  setTimeout(() => restoreSafe().then(afterRestore), 4000);
});

// Mac: closing the last window keeps Chrome running. The next new, empty window gets the tabs back.
chrome.windows.onCreated.addListener((w) => {
  if (w.type !== "normal") return;
  setTimeout(async () => {
    const normal = await chrome.windows.getAll({ windowTypes: ["normal"], populate: true });
    if (normal.length !== 1 || normal[0].id !== w.id) return;
    if (normal[0].tabs.some((t) => REAL.test(t.url || t.pendingUrl || ""))) return;
    await restoreSafe(w.id);
    await afterRestore();
  }, 1500);
}, { windowTypes: ["normal"] });
