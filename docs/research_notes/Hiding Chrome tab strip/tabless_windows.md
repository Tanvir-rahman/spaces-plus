# Chrome windows without a tab strip, and what an MV3 extension can do about it

Research date: 2026-11-06. Sources: Chrome extension API docs, Chromium source (main branch, fetched Nov 2026), Chromium Extensions Google Group, Chrome for Developers capability docs, Chrome Web Store aggregators. Note: much of the macOS-specific UI detail is not officially documented. Where a claim rests on my prior knowledge and not on a fetched source, it is marked as such or placed in Gaps.

## chrome.windows.create({type:"popup"}): UI, moving tabs in/out, multiple tabs

### Takeaway
An extension can create a popup-type window (no tab strip). It can move an existing tab INTO a new popup window by passing `tabId` to `windows.create`. But `chrome.tabs.move` only works to and from *normal* windows, so moving tabs between existing popups, or back out of a popup, through `tabs.move` is officially unsupported. "panel" and "app" types are deprecated and not usable. Whether the macOS popup shows a read-only address bar is unclear: sources disagree.

### Cited Findings
- WindowType values: `normal`, `popup` ("A browser popup."), `panel` ("Deprecated in this API… Extensions can only see their own panel windows"), `app` ("Deprecated in this API"), `devtools`. The `panel` create type "is deprecated and is available only to existing allowlisted extensions on Chrome OS." — [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- `windows.create` options include `tabId` ("The ID of the tab to add to the new window"), `url` ("A URL or array of URLs to open as tabs in the window"), `type`, `state`, `setSelfAsOpener`. — [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- `chrome.tabs.move`: "Note that tabs can only be moved to and from normal (window.type === "normal") windows." — [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- Chromium source of `tabs.move`: cross-window moves call `MoveTabToWindow(..., /*allow_other_window_types=*/false, ...)`, which confirms the normal-only restriction in code. Moves are also refused for DevTools and Picture-in-Picture tabs, and while a tab drag is in progress ("tab strip not editable"). — [tabs_api.cc (Chromium main)](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/tabs_api.cc)
- `tabs.create` called while the current window is not normal falls back to a tabbed (normal) browser window: `if (browser && browser->GetType() != TYPE_NORMAL)`. In practice, "new tab" requests aimed at a popup open in a normal window. — [tabs_api.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/tabs_api.cc)
- Chromium source of `windows.create`: `kPopup` (and `kPanel`) map to `TYPE_POPUP`, and on non-Android desktop the created type is `TYPE_APP_POPUP` with `is_trusted_source = false`. When `tabId` is given, the tab is moved with `allow_other_window_types=true`, but only `if (new_window->GetType() == TYPE_NORMAL || urls_.empty())`. So `windows.create({tabId, type:"popup"})` moves the tab into a new popup only when no `url` is also passed. The `url` field accepts an array (parsed in a loop). — [windows_api.cc (Chromium main)](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/windows_api.cc)
- MDN (Firefox docs, same API shape) describes `tabId` as moving a tab from an existing window into the new window, and says popup/panel types open "without any of the normal browser UI (address bar, toolbar, etc.)". This is Firefox wording, not confirmed for Chrome. — [MDN windows.create](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create)
- Address bar in popups, conflicting reports:
  - A 2022 Chromium-extensions thread says popups opened by web pages show an address bar, while popups created by extensions do not. It calls this the only known route to a bar-less window. — [Chromium Extensions group, May 2022](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/nRmF8iz3nG4)
  - A third-party (Orion browser) feedback thread reports that in testing, Chrome and Firefox always show at least a read-only address bar on popups, citing phishing risk. This is secondhand and concerns web-page popups. — [Orion feedback thread](https://orionfeedback.org/d/423-the-popup-window-needs-an-address-bar/24)
- Chrome Web Store extensions that open pages in popup windows with "no tab bar and address bar": "Open in Popup Window" (emvaized, open source; ~4.7 from 11 reviews per aggregator), "Open as Popup V3" (~4.0 from 2), "Open link in small window" (5.0 from 4). Review counts are small and come from the ExtScope aggregator. — [Open in Popup Window (CWS)](https://chromewebstore.google.com/detail/open-in-popup-window/gmnkpkmmkhbgnljljcchnakehlkihhie); [ExtScope listing](https://www.extscope.org/extension/gmnkpkmmkhbgnljljcchnakehlkihhie); [Open as Popup V3](https://extscope.org/extension/imjphkfldnipjnecfbohpdjibfhlegfn); [Open link in small window](https://chromewebstore.google.com/detail/Open%20link%20in%20small%20window./oegnjpfejdnchenkkcajffjmpjolcfhj); Firefox version: [AMO](https://addons.mozilla.org/firefox/addon/open-in-popup-window)

### Inferences
- A "tabless mode" extension is feasible as: one popup window per page (`windows.create({type:"popup", url})`, or `{type:"popup", tabId}` to convert an existing tab), plus the extension's own list UI (side panel or an extension page) that focuses windows with `windows.update({focused:true})`.
- Going back (popup to normal tab) cannot use `tabs.move`. The likely workaround is `windows.create({type:"normal", tabId})` (source shows the tabId move allows other window types when the new window is normal), or re-opening the URL in a normal tab and closing the popup, which loses history and form state. This is inferred from the source, not tested.
- Drawbacks of the popup approach: every page is a separate OS window (macOS Cmd-` cycling, Mission Control clutter, per-window memory overhead); no back/forward buttons or omnibox for typing URLs (the extension must provide navigation); no toolbar, so no extension action icons and no profile menu in those windows; links that open "new tab" land in a normal window (see the `tabs.create` fallback); and the side panel is per-window or per-tab, so a popup may not host the extension's side panel (unverified).
- Chrome Web Store popup extensions have low review counts. I found no evidence of a popular "fake tabless browser" extension.

### Gaps
- No official doc or fetched 2026 source describes exactly what a Chrome extension-created `TYPE_APP_POPUP` window shows on macOS. Prior knowledge, unverified: a slim title bar, possibly with a read-only origin or URL display, and no tab strip, toolbar, extensions menu, or back/forward. Needs a manual test on current Chrome for Mac.
- I could not confirm from source whether a popup window can hold more than one tab. Passing `url: [a, b]` with `type:"popup"` is accepted by the parser, but I did not verify whether the second URL lands in the popup or in a normal window. Prior understanding is that popup-type browsers are single-tab in the UI. Needs a test.
- Could not locate the current Chromium function that decides location-bar and toolbar features per window type (older code: `Browser::SupportsWindowFeature` / `ShouldShowLocationBar`; now apparently `DesktopBrowserWindowCapabilities`).

## Can an extension hide or collapse Chrome's native tab strip or vertical tabs?

### Takeaway
No extension API hides, collapses, or restyles Chrome's native tab strip (horizontal or vertical) in a normal window. The only levers are creating non-normal (popup) windows, or fullscreen, which hides all browser UI. `locked-fullscreen` exists but is ChromeOS-only and allowlisted.

### Cited Findings
- The `chrome.tabs` reference has no `tabs.hide` method or any tab-strip visibility control (unlike Firefox). It mentions the tab strip only to say discarded and frozen tabs remain visible in it. — [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- `WindowState` public values are `normal`, `minimized`, `maximized`, `fullscreen`. `locked-fullscreen` is not listed in the public reference. — [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- In source, `locked-fullscreen` requires the `lockWindowFullscreenPrivate` permission (error: "Cannot lock window to fullscreen or close a locked fullscreen window without lockWindowFullscreenPrivate manifest permission"), and locking is applied via a ChromeOS-only controller. — [windows_api.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/windows_api.cc)
- A Chromium test states that the API "is available only on Chrome OS" and loading such an extension on other platforms should fail. — [locked_fullscreen_window_apitest.cc](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/extensions/locked_fullscreen_window_apitest.cc)
- A 2022 developer report says the permission is limited to a small set of Google extension IDs (for example "Share to Classroom", "Assessment Assistant"). This is a forum claim. — [Chromium Extensions group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/iACXrLtOd6E)
- Chromium contributor Eric Lawrence (2022): changing address bar or browser chrome visibility from an extension is not expected to be possible, for security reasons. Browser UI is "immutable" apart from colours and icons (themes). — [Chromium Extensions group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/nRmF8iz3nG4)

### Inferences
- The `sidePanel` API only adds the extension's own panel. It cannot replace or hide Chrome's native vertical tabs or tab strip (no such method in the API surface reviewed; not separately fetched).
- Themes (manifest `theme`) can recolor the tab strip but not remove it (prior knowledge, not fetched).

### Gaps
- Did not fetch the `sidePanel` reference this session to quote it explicitly. Nor did I check for any 2026 origin trial or flag that exposes tab-strip visibility to extensions. None was found in search.

## chrome.windows.update({state:"fullscreen"}) on macOS; toggling via keyboard command

### Takeaway
`fullscreen` is a public `WindowState`, so an extension can put a window into or out of fullscreen with `windows.update`. On macOS, what fullscreen hides depends on the user's "Always Show Toolbar in Full Screen" setting, which is a browser-level setting that extensions cannot change.

### Cited Findings
- `WindowState.fullscreen` is public and usable in `create()` and `update()`. It cannot be combined with `left`, `top`, `width`, or `height`. — [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- Chromium for Mac has a per-browser "Always Show Toolbar in Full Screen" toggle (a helper reports the state, and a command toggles it). — [fullscreen_util_mac.h](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/fullscreen_util_mac.h?autodive=0); [browser_commands_mac.h](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/ui/browser_commands_mac.h)
- Conflicting claim: a 2022 forum reply says "the fullscreen API isn't exposed to extensions". This contradicts the documented `state:"fullscreen"`. It likely referred to toolbar-autohide behaviour, not the window state. — [Chromium Extensions group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/nRmF8iz3nG4) vs [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- Reports exist of macOS immersive-fullscreen glitches where tabs and the toolbar do not reveal correctly, including Chromium-based browsers and a macOS menu-bar autohide interaction. These come from forums, not official sources. — [Brave community](https://community.brave.com/t/show-navigation-bar-tabs-when-using-fullscreen-immersive-toolbar/281295); [GL-iNet forum](https://forum.gl-inet.com/t/full-screen-broken/71529)

### Inferences
- With "Always Show Toolbar in Full Screen" OFF, macOS fullscreen hides the tab strip and toolbar, which reveal when the mouse hits the top edge. With it ON, the tabs and toolbar stay visible, so fullscreen does not give a tabless look. This is prior knowledge, consistent with the setting's existence.
- A keyboard toggle is feasible: an MV3 `commands` entry plus an `onCommand` handler that flips `windows.update(id, {state: s === "fullscreen" ? "normal" : "fullscreen"})`. The `commands` API itself was not fetched this session.
- Drawbacks: fullscreen takes a whole macOS Space, hides the macOS menu bar and Dock, and animates in and out.

### Gaps
- Not verified on current Chrome for Mac (2026) whether extension-triggered fullscreen uses the same immersive mode as the green-button or Cmd+Ctrl+F fullscreen, or a different "presentation" mode.

## PWA, "Open as window", "Install page as app", and --app=URL windows

### Takeaway
Installed web apps and `--app=` windows are app windows without a tab strip. The PWA "tabbed" display mode, which adds an app-scoped tab strip, has shipped only on ChromeOS according to Chrome's docs.

### Cited Findings
- Tabbed application mode: opt in with `"display_override": ["tabbed"]` (with `"display": "standalone"`), plus an optional `tab_strip` (home tab, new-tab button). Detect it with the `display-mode: tabbed` media query. Status table: origin trial completed, launch "Completed (ChromeOS)". The page names no other platforms. The home tab is pinned and never navigates. The new-tab button appears only if its URL is outside the home tab scope. — [Chrome for Developers: Tabbed application mode](https://developer.chrome.com/docs/capabilities/tabbed-application-mode)
- MDN marks `display_override` as experimental. — [MDN display_override](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override)
- `windows.create` has a dedicated Isolated Web App path. It sets `is_trusted_source = true`, rejects `tabId` ("Creating a new window for an Isolated Web App does not support adding a tab by its ID"), and allows only one tab per `isolated-app:` window. — [windows_api.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/api/tabs/windows_api.cc)

### Inferences (prior knowledge, not fetched this session)
- "Install page as app…" (formerly "Create shortcut… → Open as window") and `--app=URL` produce a standalone app window. It has a title bar with an app menu (⋮), and the origin appears only when navigating out of scope. It has no tab strip, no omnibox, no extension toolbar (extensions are reachable via the app menu), and back/forward is limited to an in-title-bar back button in some versions or the keyboard. Each app window is its own Dock or app entry on macOS.
- These windows are user-driven: an extension cannot convert an arbitrary tab into an installed-app window. The MV3 `chrome.management` app-install capabilities are restricted, and the `app` window type is deprecated.

### Gaps
- No fetched source documents macOS app-window chrome (title bar contents, extension access) in 2026.
- No source found on whether tabbed mode has shipped on macOS, Windows, or Linux by Nov 2026. The Chrome doc mentions only ChromeOS.

## Known extensions faking a tabless browser and user feedback

### Takeaway
Only small "open link in popup" utilities exist (low review counts). I found no well-known extension that runs a full tabless workflow using popup windows managed from a sidebar.

### Cited Findings
- See the store listings under the first question: "Open in Popup Window" (no tab bar or address bar, opens at the cursor, open source), "Open as Popup V3" ("clean popup window without tabs, address bar, or browser UI"), "Open link in small window". Ratings come from ExtScope: 11, 2, and 4 reviews. ExtScope notes that review bodies were often not synced, and Google does not verify reviews. — [ExtScope](https://www.extscope.org/extension/gmnkpkmmkhbgnljljcchnakehlkihhie); [Open as Popup V3](https://extscope.org/extension/imjphkfldnipjnecfbohpdjibfhlegfn)
- The opposite category, "Single Window", forces popups back into tabs (3.7 from 21 reviews), which suggests some users dislike popup windows. — [ExtScope Single Window](https://www.extscope.org/extension/pnbbookneacpggbngfmhfggennhigonh)

### Gaps
- No substantive user-review text was retrieved about the missing tab strip or address bar. Reddit and Hacker News were not searched within the call budget.
