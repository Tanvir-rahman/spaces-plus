---
title: Leaving Arc? An Arc-Style Sidebar for Chrome (and Brave)
published: false
description: How Spaces Plus, an Arc-style vertical tabs extension, was built with no servers and no account. What worked, what Chrome won't allow, and how to move over.
tags: showdev, chrome, javascript, webdev
---

> **Other title options:**
> - Arc Is Done. Its Sidebar Doesn't Have to Be.
> - Arc's Best Part, Rebuilt in 2,300 Lines of JavaScript
> - Arc Refugees: Your Spaces Can Live in Chrome Now

The Browser Company stopped adding features to Arc and moved its focus to Dia. Arc still opens, but everyone who uses it knows how this ends: one day a site breaks, an update doesn't come, and it's time to move.

Most people leaving Arc don't miss the AI features or Easels. They miss **the sidebar**: spaces, pinned tabs that act like bookmarks, favorites at the top, and tabs that tidy themselves away.

**Spaces Plus** is that part, rebuilt as a Chrome extension. It also runs in Brave, Edge and other Chromium browsers. This post covers how it works, the Chrome limits it runs into, and the bugs that took the longest to fix.

---

## What made the cut (and what didn't)

These are the parts of Arc's sidebar that are hard to give up:

| Arc feature | Spaces Plus |
|---|---|
| Spaces with their own colour and icon | ✅ |
| Pinned tabs per space (survive restart) | ✅ |
| Favorites row at the top | ✅ |
| Switch spaces with a shortcut | ✅ `Alt+Shift+←/→`, `Cmd/Ctrl+1–9` |
| Command bar (`Cmd+T` in Arc) | ✅ `Cmd/Ctrl+K` or `/` |
| Split view | ✅ Chrome 155+ |
| Unused tabs go to sleep | ✅ |
| Hide the browser's own tab bar | ⚠️ Only in Brave (see below) |
| Boosts, Easels, Little Arc | ❌ |

The project followed two rules from day one:

1. **No server and no account.** Everything stays inside the browser.
2. **Use what Chrome already has.** If Chrome has a feature for something, use it instead of rebuilding it.

The second rule ended up shaping almost every decision.

---

## The data model: a space is a tab group plus a bookmark folder

The first version kept its own list of tabs in extension storage. That broke right away. Chrome is the real owner of your tabs, so a separate copy drifted out of date as soon as a tab was dragged, a window closed, or the browser restarted.

So the extension keeps no copy at all. A space is just two things Chrome already has:

- **A tab group** holds the space's open tabs. The group's name is the space's name.
- **A bookmark folder** under `Other bookmarks › Spaces Plus` holds its **pinned tabs**. A `★ Favorites` folder holds the favorites.

```js
// A "space" = a named Chrome tab group + a bookmark folder holding its pinned tabs.
// Spaces live in extension storage so they survive even when their group has no open tabs.
{ id: "uuid", name: "Work", color: "blue", hex: "#3b6fe0", icon: "💼", folderId: "123" }
```

That gives you all of this for free:

- **Pinned tabs survive anything.** They're bookmarks. Reinstall the extension or wipe its storage, and they're still there.
- **Sync comes from Chrome.** If you sync bookmarks, your pinned tabs show up on your other computers. No server involved.
- **Chrome's tab bar and the sidebar always agree.** The extension has no separate idea of which tab belongs to which space. Chrome's tab groups decide that.
- **What you already have comes along.** On start, any tab group or bookmark folder that isn't a space yet becomes a new space:

```js
for (const g of await chrome.tabGroups.query({ windowId: winId })) {
  if (!spaces.some((s) => s.name === g.title)) {
    spaces.push({ id: crypto.randomUUID(), name: g.title, color: g.color });
  }
}
```

The catch: Chrome only allows **nine tab group colours**, and Arc users like picking any colour. So a space keeps your exact colour in the sidebar, and its tab group gets the closest of Chrome's nine:

```js
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
```

---

## Switching spaces

When you switch, the target space's group opens, every other group collapses, and the last tab you used in that space comes back to the front. With "sleep on switch" turned on, tabs in the other spaces are **discarded**. They stay in the list, but Chrome frees their memory.

```js
for (const t of tabs) {
  if (t.groupId >= 0 && t.groupId !== g?.id && !t.active && !t.audible && !t.discarded) {
    chrome.tabs.discard(t.id).catch(() => {});
  }
}
```

The `!t.audible` check is there because putting someone's Spotify tab to sleep mid-song is a quick way to get uninstalled.

---

## Where the sidebar lives: two modes

Chrome gives extensions a **side panel** (`chrome.sidePanel`). It looks like the obvious choice, but it has two problems for an Arc-style sidebar:

- It has a **minimum width of about 320px**. Arc's sidebar can be much narrower.
- **Chrome decides** whether it sits on the left or the right.

So Spaces Plus has two modes.

**1. Floating window (the default).** A small popup window sits right next to the browser window, and the browser window shrinks to make room:

```js
const dock = await chrome.windows.create({
  url: "panel.html?dock=1", type: "popup", focused: false,
  left: m.left, top: m.top, width: dockWidth, height: m.height,
});
await chrome.windows.update(m.id, {
  left: m.left + dock.width, width: Math.max(400, m.width - dock.width), focused: true,
});
```

It can go as narrow as 48px, which shows only icons, and it follows the browser window when you move or resize it. A full-screen window can't share the screen with another window, so opening the sidebar takes the browser out of full screen first.

**2. Side panel.** It sits inside the browser window, works in full screen and needs no setup. The trade-off is the 320px minimum width.

Both modes run the same `panel.html`, so every feature works in both.

---

## The wall: Chrome's tab bar can't be hidden

This is the first thing every Arc user asks about, and it took the most research.

**An extension cannot hide Chrome's tab bar.** There's no API, no setting and no policy for it. Chrome's new built-in vertical tabs can collapse but never disappear completely. Flags, enterprise policies, app windows and popup windows were all tested. Each one either loses normal browser features or doesn't work in current Chrome.

**Brave can.** Brave's own vertical tabs have a setting to hide them completely when collapsed. Turn that on, collapse the tabs, open Spaces Plus as a side panel, and you get the closest thing to Arc so far: one clean sidebar and no tab bar. To set it up:

1. Open `brave://settings/appearance` and turn on **vertical tabs**.
2. Turn on **hide completely when collapsed**.
3. Collapse the tab column.
4. In Spaces Plus Customize, set the mode to **Side panel**.

Brave's vertical tabs and Spaces Plus read the same tab groups, so they stay in sync even when one of them is hidden.

---

## The bug that took longest: tabs came back blank

Moving from another browser means opening a lot of tabs at once; one test file had 109. Opening them all awake would grind the computer to a halt, so each tab was put to sleep right after it was created.

Every one of them came back **blank**.

The cause: if you discard a tab before its page has loaded, Chrome forgets the URL and the tab stays empty for good. The first fix waited until the tab *had a URL*. That passed in the test browser but still failed in real Brave, because a tab has a URL before it has loaded anything.

The fix that works waits for Chrome to report the page as fully loaded:

```js
// Put a just-created tab to sleep once its page has loaded. Discarding sooner leaves a blank tab.
export function sleepWhenReady(id) {
  const done = () => chrome.tabs.onUpdated.removeListener(on);
  const on = (tid, c, t) => {
    if (tid !== id || t.status !== "complete" || !t.url || t.url === "about:blank") return;
    done();
    chrome.tabs.discard(id).catch(() => {});
  };
  chrome.tabs.onUpdated.addListener(on);
  setTimeout(done, 60000); // never loaded? leave it awake rather than blank
}
```

If a page never finishes loading, the tab simply stays awake. A tab that uses memory beats a tab that loses its URL.

**A second bug: restore ran twice.** Spaces Plus keeps a backup list of each space's open tabs and reopens them if the browser loses them. In Manifest V3 the background worker can start more than once around a browser launch, so restore sometimes ran twice and every tab opened twice. A short lock in session storage fixed it:

```js
const { restoreRan } = await session.get("restoreRan");
if (restoreRan && Date.now() - restoreRan < 120000) return 0;
await session.set({ restoreRan: Date.now() });
```

---

## Moving between browsers: one file

The Chrome Web Store version and a self-loaded copy get different extension IDs, and Brave doesn't share storage with Chrome. So Customize has **Export** and **Import** buttons under *Move to another browser*.

The export is a small JSON file with your spaces and their colours and icons, plus pinned tabs, favorites, open tabs and settings. Import is built to be **safe to run twice**:

- It merges spaces by name and never deletes anything.
- It skips any URL that's already open.
- It skips pinned tabs and favorites that already exist.
- New tabs open asleep, using `sleepWhenReady`.

Real-world test: 13 spaces and 116 tabs moved from Chrome to Brave.

---

## Testing an extension Chrome won't let you automate

A small detail that may save you an afternoon: **branded Google Chrome now ignores `--load-extension`**, so Puppeteer can't load an unpacked extension into it. The Spaces Plus tests run Puppeteer against the **Brave** app instead, which still accepts the flag:

```js
const browser = await puppeteer.launch({
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
```

The tests drag tabs between spaces, reorder spaces, run Start over and Import, and check that a large import comes back with every URL.

---

## Privacy, briefly

No servers, no analytics, no account and no remote code. The extension makes no network requests of its own. Your data lives in Chrome's extension storage and in your own bookmarks, and uninstalling removes it. That's partly a principle and partly practical: with no backend, there's nothing to maintain or breach.

---

## Coming from Arc: 5-minute setup

1. Install **Spaces Plus** from the Chrome Web Store: <https://chromewebstore.google.com/detail/kabkpkdiclbphidmcpjffbenncpkjclk>. The same link works in Brave and Edge.
2. Press `Alt+S` to open the sidebar.
3. Create one space for each of your Arc spaces. Right-click a space to give it a colour or emoji.
4. Open the sites you use, then right-click › **Pin to "space name"** on the ones you want to keep. That replaces Arc's pinned section.
5. Right-click › **Add to Favorites** on your top sites.
6. Already use Chrome tab groups? Nothing to do. Each group becomes a space automatically.

**Still missing compared with Arc:** a one-click import from Arc. Arc stores its sidebar in its own file format, and there's no reader for it yet. If enough people ask, it's next.

---

## Feedback wanted

Use it for a day. If something feels un-Arc-like, say so in the comments, because that list is the roadmap. Drag to reorder spaces, any colour, and moving between browsers all started as requests from Arc users.

*Built by AppMotives. Questions: support@appmotives.com. Spaces Plus is not affiliated with The Browser Company; Arc is their trademark.*
