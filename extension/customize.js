import * as core from "./core.js";

const { COLORS, COLOR_NAMES, DEFAULTS } = core;
const form = document.getElementById("form");
let settings = await core.getSettings();
let spaces = await core.getSpaces();

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const openUrl = (url) => chrome.tabs.create({ url });

let saveTimer, quietUntil = 0; // right after our own change, ignore its echo from storage
function set(key, value) {
  settings[key] = value;
  clearTimeout(saveTimer);
  quietUntil = Date.now() + 500;
  saveTimer = setTimeout(() => core.saveSettings(settings), 40);
  refresh();
}

// Every control is described here; build() turns each into a row.
const SECTIONS = [
  ["Sidebar", [
    { key: "mode", label: "Where it opens", note: "Floating sits left of the browser window and can be any width. Chrome's side panel can't go thinner than about 320px.",
      seg: [["panel", "Chrome side panel"], ["window", "Floating, left"]] },
    { key: "dockWidth", label: "Width", note: "You can also drag the floating window's edge.", range: [48, 520, 1, "px"], when: (s) => s.mode === "window" },
    { label: "Side panel position", note: "Chrome decides which side its panel opens on.", button: ["Open Chrome setting", () => openUrl("chrome://settings/appearance")], when: (s) => s.mode === "panel" },
  ]],
  ["Show", [
    { key: "showNav", label: "Back, forward and reload" },
    { key: "showUrl", label: "Address bar" },
    { key: "showFavs", label: "Favorites" },
    { key: "showHead", label: "Space name" },
    { key: "showNew", label: "New Tab button" },
    { key: "showClear", label: "Clear button" },
    { key: "showHints", label: "Hint when a space has no pinned tabs" },
    { key: "showDock", label: "Space switcher", note: "Without it, switch with ⌘1–9, Option+Shift+arrows, or a sideways swipe." },
  ]],
  ["Size", [
    { key: "fontSize", label: "Text", range: [11, 17, 0.5, "px"] },
    { key: "rowHeight", label: "Tab height", range: [22, 44, 1, "px"] },
    { key: "favSize", label: "Favorite tiles", range: [28, 72, 1, "px"] },
    { key: "radius", label: "Corner roundness", range: [0, 16, 1, "px"] },
    { key: "pad", label: "Edge spacing", range: [2, 20, 1, "px"] },
  ]],
  ["Look", [
    { key: "theme", label: "Appearance", when: (s) => s.bgMode !== "custom", seg: [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]] },
    { key: "bgMode", label: "Sidebar colour", note: "Follow each space's colour, or always use one colour you pick.", seg: [["space", "Space colour"], ["custom", "My colour"]] },
    { key: "bgColor", label: "My colour", color: true, when: (s) => s.bgMode === "custom" },
    { key: "tint", label: "Space colour strength", when: (s) => s.bgMode !== "custom", note: "How much the sidebar takes on the space's colour.", range: [0, 80, 1, "%"] },
    { key: "background", label: "Background", seg: [["flat", "Flat"], ["gradient", "Gradient"]] },
    { key: "dockStyle", label: "Space switcher icons", note: "Auto shows the space you're in as its icon and the others as dots.", seg: [["auto", "Auto"], ["dots", "Dots"], ["initials", "Icons"]] },
  ]],
  ["Spaces", "spaces"],
  ["Move to another browser", [
    { label: "Export", note: "Saves all spaces, pinned tabs, Favorites, open tabs and settings to one file.", button: ["Export file", async () => {
      const data = await core.exportAll();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `spaces-plus-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }] },
    { label: "Import", note: "In the other browser (Brave, Edge, Chrome on another computer), install Spaces Plus and pick that file. Spaces are added to what's there; nothing is deleted. Tabs open asleep.", button: ["Import file…", (e) => {
      const btn = e.target, input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async () => {
        btn.disabled = true;
        btn.textContent = "Importing…";
        try {
          const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
          const n = await core.importAll(JSON.parse(await input.files[0].text()), win.id);
          btn.textContent = `Done: ${n.spaces} new spaces, ${n.tabs} tabs`;
          settings = await core.getSettings();
          spaces = await core.getSpaces();
          refresh();
        } catch (err) {
          btn.textContent = "Import file…";
          alert("Couldn't import: " + (err.message || err));
        }
        btn.disabled = false;
      };
      input.click();
    }] },
  ]],
  ["Behaviour", [
    { key: "sleepOnSwitch", label: "Sleep other spaces when switching", note: "Frees memory. Tabs reload when you come back." },
    { key: "autoGroup", label: "Put new tabs in the current space" },
    { key: "restoreTabs", label: "Bring tabs back when Chrome opens", note: "Spaces Plus remembers each space's open tabs. If Chrome starts without them, they come back asleep. Works on its own." },
    { label: "Chrome's own restore", note: "Also set Chrome to “Continue where you left off”. Then Chrome keeps history and scroll position too, and the backup only fills gaps. Do it in each Chrome profile.",
      button: ["Open Chrome setting", () => openUrl("chrome://settings/onStartup")] },
    { label: "Keyboard shortcuts", note: "Option+S opens the sidebar. Change keys in Chrome.", button: ["Edit shortcuts", () => openUrl("chrome://extensions/shortcuts")] },
    { label: "Reset look and layout", note: "Spaces and tabs stay as they are.", button: ["Reset", () => {
      settings = { ...DEFAULTS, mode: settings.mode, dockWidth: settings.dockWidth, sleepOnSwitch: settings.sleepOnSwitch, autoGroup: settings.autoGroup, restoreTabs: settings.restoreTabs };
      core.saveSettings(settings);
      refresh();
    }] },
    { label: "Start over", note: "Closes every tab in your spaces and your Favorites, then deletes all spaces, pinned tabs, Favorites and the tab backup. You get one empty space. Your look settings stay.",
      danger: true, button: ["Start over…", async (e) => {
        const ok = confirm("Start over?\n\nThis closes all tabs in your spaces and Favorites, and permanently deletes every space, pinned tab, Favorite and the tab backup.\n\nThis can't be undone.");
        if (!ok) return;
        e.target.disabled = true;
        e.target.textContent = "Clearing…";
        await core.resetAll();
        e.target.textContent = "Done";
      }] },
  ]],
];

const updaters = []; // refresh() calls these so every control shows the current value
function refresh() { for (const u of updaters) u(settings); }

function item(def) {
  const row = el("div", "item");
  const label = el("label", null, def.label);
  if (def.note) label.append(el("span", "note", def.note));
  row.append(label);
  if (def.when) updaters.push((s) => (row.hidden = !def.when(s)));

  if (def.button) {
    const b = el("button", "btn" + (def.danger ? " danger" : ""), def.button[0]);
    b.onclick = def.button[1];
    row.append(b);
  } else if (def.seg) {
    const seg = el("div", "seg");
    const btns = def.seg.map(([v, text]) => {
      const b = el("button", null, text);
      b.onclick = () => set(def.key, v);
      seg.append(b);
      return [v, b];
    });
    updaters.push((s) => btns.forEach(([v, b]) => b.classList.toggle("on", s[def.key] === v)));
    row.append(seg);
  } else if (def.color) {
    const input = Object.assign(el("input", "swatch"), { type: "color", id: "f-" + def.key });
    input.oninput = () => set(def.key, input.value);
    updaters.push((s) => { if (document.activeElement !== input) input.value = s[def.key]; });
    label.htmlFor = input.id;
    row.append(input);
  } else if (def.range) {
    const [min, max, step, unit] = def.range;
    const box = el("div", "range");
    const input = Object.assign(el("input"), { type: "range", min, max, step });
    const out = el("output");
    input.oninput = () => set(def.key, +input.value);
    updaters.push((s) => { if (document.activeElement !== input) input.value = s[def.key]; out.textContent = s[def.key] + unit; });
    box.append(input, out);
    row.append(box);
    label.htmlFor = input.id = "f-" + def.key;
  } else {
    const input = Object.assign(el("input", "sw"), { type: "checkbox", id: "f-" + def.key });
    input.onchange = () => set(def.key, input.checked);
    updaters.push((s) => (input.checked = !!s[def.key]));
    label.htmlFor = input.id;
    row.append(input);
  }
  return row;
}

// ---------- spaces ----------
const firstChar = (s) => [...new Intl.Segmenter().segment(s.trim())][0]?.segment || "";
let spaceGroup;
function drawSpaces() {
  if (spaceGroup.contains(document.activeElement) && document.activeElement.type === "text") return; // don't reset what you're typing
  spaceGroup.replaceChildren(...spaces.map((s, i) => {
    const row = el("div", "item space");
    const hex = core.spaceHex(s);

    const icon = Object.assign(el("input", "icon"), { type: "text", value: s.icon || "", placeholder: "·", title: "Icon: type or paste an emoji (Ctrl+⌘+Space)" });
    icon.onchange = () => core.setSpaceIcon(s.id, firstChar(icon.value));

    const name = Object.assign(el("input", "sname"), { type: "text", value: s.name, title: "Name" });
    name.onchange = () => core.renameSpace(s.id, name.value);
    name.onkeydown = (e) => { if (e.key === "Enter") name.blur(); };

    const sw = el("div", "swatches");
    for (const c of COLOR_NAMES) {
      const b = el("button", !s.hex && s.color === c ? "on" : "");
      b.style.background = COLORS[c].dot;
      b.title = c[0].toUpperCase() + c.slice(1);
      b.onclick = () => core.recolorSpace(s.id, c);
      sw.append(b);
    }
    const custom = el("label", s.hex ? "on" : "");
    custom.title = "Any colour";
    if (s.hex) custom.style.background = hex;
    const picker = Object.assign(el("input"), { type: "color", value: hex });
    let t;
    picker.oninput = () => { clearTimeout(t); t = setTimeout(() => core.recolorSpace(s.id, picker.value), 80); };
    custom.append(picker);
    sw.append(custom);

    const move = el("div", "move");
    const up = el("button", null, "▲"), down = el("button", null, "▼");
    up.title = "Move up"; down.title = "Move down";
    up.disabled = i === 0; down.disabled = i === spaces.length - 1;
    up.onclick = () => core.moveSpace(s.id, -1);
    down.onclick = () => core.moveSpace(s.id, 1);
    move.append(up, down);

    row.append(icon, name, sw, move);
    return row;
  }));
}

for (const [title, defs] of SECTIONS) {
  form.append(el("h2", null, title));
  const group = el("div", "group");
  if (defs === "spaces") { spaceGroup = group; drawSpaces(); }
  else for (const d of defs) group.append(item(d));
  form.append(group);
}
refresh();

chrome.storage.onChanged.addListener(async (c, area) => {
  if (area !== "local") return;
  if (c.settings && Date.now() > quietUntil) { settings = await core.getSettings(); refresh(); } // e.g. floating window resized by hand
  if (c.spaces) { spaces = c.spaces.newValue || []; drawSpaces(); }
});
