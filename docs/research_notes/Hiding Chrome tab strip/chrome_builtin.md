# Built-in Chrome ways to hide or shrink the tab strip (macOS focus, as of Nov 2026)

## How do Chrome's native vertical tabs work (on/off, collapse, narrowest size, any full hide)?

### Takeaway
Native vertical tabs shipped with Chrome 147 (stable, around March–April 2026, rolled out gradually). The sidebar can be dragged narrower or collapsed to an icon-only strip with the arrow button or Cmd+Shift+L. Since about Chrome 152 a collapsed strip can expand on hover. No source shows a built-in way to hide the vertical strip completely: there is no zero-width or fully auto-hiding option.

### Cited Findings
- **Turn on, from the official Chrome Help page:**
  - Right-click blank tab-strip space or a tab and choose "Show Tabs Vertically."
  - Or go to Settings > Appearance > "Tab position" and pick "Vertical" or "Horizontal."
  - Or go to More (⋮) > More Tools > "Show Tabs Vertically."
  - On Mac there is also View > "Show Tabs Vertically," a checkable menu item.
  - Source: [Chrome Help – Manage tabs](https://support.google.com/chrome/answer/2391819?hl=en&co=GENIE.Platform%3DDesktop)
- **Official description:** "Vertical tabs move your tab strip to the side of your window." You can resize the strip. — [Chrome Help](https://support.google.com/chrome/answer/2391819?hl=en&co=GENIE.Platform%3DDesktop)
- **Expand on hover (official):** Right-click the menu icon at the top of the vertical strip and click "Expand Collapsed Tabs by Hovering." — [Chrome Help](https://support.google.com/chrome/answer/2391819?hl=en&co=GENIE.Platform%3DDesktop)
- **Release:** Chrome 147 launched with vertical tabs on April 9, 2026, per Winaero. — [Winaero](https://winaero.com/chrome-147-released-with-vertical-tabs-and-improved-reader-mode/)
  - Google's enterprise release notes reportedly list "Vertical tabs" under Chrome 147, dated March 25, 2026. That date conflicts with the April 7–9 dates in the press. — [Chrome Enterprise release notes (search snippet)](https://support.google.com/chrome/a/answer/10314655?hl=en)
  - The rollout was gradual on macOS, Windows and Linux. — [BGR](https://www.bgr.com/2146788/how-use-google-chrome-vertical-tabs/), [heise, Apr 9 2026](https://www.heise.de/en/news/Chrome-Vertical-tabs-and-improved-reading-mode-11250118.html?view=print)
- **History:** The feature first appeared in Canary in Nov 2025. It was behind a flag in Chrome 145–146. — [Android Authority](https://androidauthority.com/chrome-browser-vertical-tabs-3617534), [SuperchargeBrowser 147 notes](https://www.superchargebrowser.com/library/chrome-147-whats-new-tab-users/)
- **Collapse:** "A button at the top of the new Chrome interface will also let you minimize the vertical tab panel." — [BGR](https://www.bgr.com/2146788/how-use-google-chrome-vertical-tabs/)
  - The arrow at the top shrinks the sidebar to icon-only width. — [ChromeStory, Jun 2026](https://chromestory.com/2026/06/how-to-enable-vertical-tabs-in-google-chrome/)
  - The collapse arrow snaps the sidebar to an "icon rail" and restores the previous width on a second click. — [SuperchargeBrowser](https://www.superchargebrowser.com/library/customize-vertical-tabs-chrome-settings/)
- **Width:** Drag the sidebar's right edge. Narrow widths clip titles down to favicons. "Chrome doesn't publish an exact pixel range." — [SuperchargeBrowser](https://www.superchargebrowser.com/library/customize-vertical-tabs-chrome-settings/) (this vendor sells a tab extension, so treat it as a secondary source)
- **Keyboard shortcut:** Cmd+Shift+L on Mac (Ctrl+Shift+L on Windows) toggles between expanded and collapsed.
  - Leopeva64 first spotted it in Canary. — [Leopeva64 on X](https://x.com/Leopeva64/status/2074324623164883359?lang=en-GB)
  - It is reported in Stable 152.0.7977.83. — [PiunikaWeb, Sep 7 2026](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)
- **Hover-expand rollout:**
  - It reached Stable in Chrome 152 without needing a flag. The tooltip reads "To turn this off, right-click here." — [PiunikaWeb, Sep 2026](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)
  - It was reported as becoming the default. — [PiunikaWeb, Aug 29 2026](https://piunikaweb.com/2026/08/29/chrome-vertical-tabs-auto-expand-on-hover-default/)
  - The old flag was `chrome://flags/#vertical-tabs-expand-on-hover`. — [AskVG](https://www.askvg.com/how-to-enable-auto-expand-vertical-tabs-on-hover-in-google-chrome/)
- **No full hide:** Chrome "doesn't hide the sidebar completely," so it is not a "frameless" experience. — [PiunikaWeb](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)

### Inferences
- The narrowest built-in state is the collapsed icon strip, roughly one favicon wide. Hover-expand makes that strip temporarily wider; it does not make it disappear.
- Unlike Edge or Arc, Chrome has no auto-hide that takes the strip to zero width.
- In a third-party aggregator search, one snippet claimed hover-expand is the default "as of Chrome 156" and that it is turned off in Settings > Appearance under "Auto expand tabs on hover." This is unverified, and the version is ahead of the cited sources.

### Gaps
- No official pixel width for the collapsed strip.
- Conflicting reports on whether the `vertical-tabs-expand-on-hover` flag was removed: one guide says it was gone in 154, another found it still present in 150. Not verified.
- No primary Google blog post was found that confirms the exact stable version for hover-expand.

## How do you switch from vertical tabs back to horizontal top tabs (exact menu wording)?

### Takeaway
Use "Show Tabs Horizontally." It is in the right-click menu on the vertical strip or on any tab, in ⋮ > More Tools, and in Settings > Appearance > Tab position > "Horizontal." On a Mac, you can also untick View > "Show Tabs Vertically."

### Cited Findings
- **Official wording:** "Show Tabs Horizontally" in the tab-strip or tab right-click menu and in ⋮ > More Tools. In Settings > Appearance, use "Tab position" → "Horizontal." On Mac, uncheck View > "Show Tabs Vertically." — [Chrome Help](https://support.google.com/chrome/answer/2391819?hl=en&co=GENIE.Platform%3DDesktop)
- **Older wording in Canary/Beta builds:** "Show tabs on side," "Move tabs to side," and "Show tabs at the top." These labels changed between builds. — [search aggregation of Digitalcitizen, Windows Report, PCWorld coverage](https://www.digitalcitizen.life/enable-chrome-vertical-tabs-canary/)

### Inferences
- Users on older or Canary builds may still see the earlier labels. "Show Tabs Horizontally" is the current stable wording.

### Gaps
- None significant.

## Are there chrome://flags or command-line switches that hide the tab strip or toolbar?

### Takeaway
No current flag hides the tab strip in a normal window.
- **Vertical-tabs flags:** `#vertical-tabs` and `#vertical-tabs-expand-on-hover` only enable or adjust the feature. They became unnecessary from Chrome 147 and 152 respectively.
- **What does hide all browser UI:** the launch switches `--app=URL` and `--kiosk`. They do this by giving up the normal tabbed window entirely.

### Cited Findings
- `chrome://flags/#vertical-tabs` was the enabling flag in 145–147. — [Winaero](https://winaero.com/chrome-147-released-with-vertical-tabs-and-improved-reader-mode/), [Pureinfotech](https://pureinfotech.com/enable-vertical-tabs-chrome/)
- ChromeStory, June 2026: "no flags, no extensions needed" on desktop now. — [ChromeStory](https://chromestory.com/2026/06/how-to-enable-vertical-tabs-in-google-chrome/)
- `chrome://flags/#vertical-tabs-expand-on-hover` controlled hover-expand before the Chrome 152 rollout. — [SuperchargeBrowser](https://www.superchargebrowser.com/library/customize-vertical-tabs-chrome-settings/), [PiunikaWeb](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)
- **Older flag:** an Apple Community answer suggested `chrome://flags/#enable-immersive-fullscreen-toolbar` for Mac full-screen toolbar behavior. — [Apple Community](https://discussions.apple.com/thread/255061396)
- **`--app="URL"`:** Launch on Mac with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --app="URL"`. It opens a window without the address bar, tabs or toolbars. — [Kitemetric blog](https://kitemetric.com/blogs/unlocking-the-power-of-chrome-s-app-flag)
- **`--kiosk URL`:** Launches Chrome full screen with no browser UI, and Cmd+Q exits. It does not lock down macOS. — [ManageEngine](https://www.manageengine.com/mobile-device-management/articles/chrome-kiosk-mode.html)

### Inferences
- `--app` and `--kiosk` are the only built-in ways to get zero tab strip, and each window then shows a single site.
- The installable-app path, "Install page as app" or "Open as window," gives the same tab-less window. It is a closely related built-in option, but it is not sourced here.

### Gaps
- The current status of `#enable-immersive-fullscreen-toolbar` on Chrome 150+ is not verified; it may have expired.
- No sourced "compact mode" or "hide tab strip" flag exists in Chrome as of 2026.
- The official Chromium command-line documentation was not fetched.

## Enterprise policies affecting the tab strip or vertical tabs?

### Takeaway
No Chrome enterprise policy for vertical tabs or tab-strip position was found. Edge has one; Chrome apparently does not, but this is not fully verified.

### Cited Findings
- heise at launch: "it remains open whether Google will make the new functions controllable via enterprise policies." — [heise](https://www.heise.de/en/news/Chrome-Vertical-tabs-and-improved-reading-mode-11250118.html?view=print)
- The Chrome Enterprise release notes for 150–152 mention "simplified tab strip" (150) and a macOS "glass" effect on the tab strip (152). No vertical-tab policy appears in them. — [Chrome Enterprise release notes](https://support.google.com/chrome/a/answer/10314655?hl=en)
- Edge's `VerticalTabsAllowed` policy can remove the vertical layout option. — [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/verticaltabsallowed)
- ChromeStory advises checking chrome://management if the option is missing on a managed browser. — [ChromeStory](https://chromestory.com/2026/06/how-to-enable-vertical-tabs-in-google-chrome/)

### Inferences
- Managed Macs held on Chrome versions below 147 will not show vertical tabs at all.

### Gaps
- The chromeenterprise.google/policies list was not directly searched; a newer policy could exist.
- The 145–149 sections of the release notes were truncated in the fetch.

## macOS full screen: "Always Show Toolbar in Full Screen", presentation mode, Cmd+Ctrl+F, Cmd+Shift+F

### Takeaway
On a Mac, View > "Always Show Toolbar in Full Screen" decides what full screen shows.
- **Unchecked:** full screen hides the tab strip and toolbar, and they reveal when the mouse goes to the top edge.
- **Checked:** the tabs and toolbar stay visible.

This is the main built-in way to get a tab-free view while keeping a normal tabbed window. Whether native vertical tabs also hide in full screen is not documented by Google.

### Cited Findings
- **Apple Community:**
  - Chrome full screen covers the tabs.
  - The fix to keep them visible is View > "Always Show Toolbar in Full Screen."
  - One user said the option was missing on an older Mac.
  - Source: [Apple Community](https://discussions.apple.com/thread/255061396)
- **Brave (Chromium-based):** its vertical tabs hide in browser full screen and reveal on mouse hover, governed by the Mac "Always show toolbar in fullscreen" setting. QA confirmed this in Oct 2023. This is Brave, not Chrome. — [Brave issue #33136](https://github.com/brave/brave-browser/issues/33136)
- **Mac menu bar:** "Automatically hide and show the menu bar" (System Settings) controls whether the macOS menu bar appears in full screen. — [Apple support (search snippet)](https://support.apple.com/en-euro/guide/mac-help/mchl9c21d2be/15/mac)

### Inferences
- With the toolbar option off, Cmd+Ctrl+F (or the green window button, or View > Enter Full Screen) should hide the horizontal tab strip and toolbar. They return when the mouse hits the top edge.
- Native vertical tabs probably follow the same rule, as Brave's do, but nothing confirms this. Test it on Chrome 152+.
- Cmd+Shift+F has historically been the shortcut for "Always Show Toolbar in Full Screen." This comes from background knowledge, not from a cited source.
- "Presentation mode" was the older Mac name for toolbar-less full screen and was folded into this toggle. Also background knowledge, not sourced.

### Gaps
- No Google documentation was found on how vertical tabs behave in Mac full screen.
- The exact current Cmd+Shift+F binding is not verified for Chrome 150+.
- Windows difference (background knowledge, unsourced): F11 full screen hides tabs and toolbar, and there is no "always show toolbar" option.

## Anything like Arc/Edge "auto-hide vertical tabs" in Chrome?

### Takeaway
No such option is documented. The closest built-in setup is the collapsed icon strip with "Expand Collapsed Tabs by Hovering" turned on, but the icon strip stays on screen. A full auto-hide exists only in full screen (if confirmed) or with `--app` and `--kiosk`.

### Cited Findings
- Hover-expand widens the strip from the collapsed icon rail; it does not hide it. — [Chrome Help](https://support.google.com/chrome/answer/2391819?hl=en&co=GENIE.Platform%3DDesktop), [PiunikaWeb](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)
- "Doesn't hide the sidebar completely." — [PiunikaWeb](https://piunikaweb.com/2026/09/07/chrome-vertical-tabs-expand-on-hover/)

### Inferences
- If you want zero tab UI in a normal window, nothing built-in does it as of Nov 2026. An extension or another browser is needed; that topic belongs to other researchers.

### Gaps
- No Chromium bug tracker entry for a "fully hide vertical tabs" request was found.
