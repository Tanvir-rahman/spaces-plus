// Click the toolbar button once: opens a new window with one tab group per Arc space.
chrome.action.onClicked.addListener(async () => {
  const spaces = await (await fetch(chrome.runtime.getURL("tabs.json"))).json();
  const win = await chrome.windows.create({ focused: true });
  const blank = win.tabs[0].id;
  for (const space of spaces) {
    const ids = [];
    for (const url of space.urls) {
      const t = await chrome.tabs.create({ windowId: win.id, url, active: false });
      ids.push(t.id);
    }
    const groupId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(groupId, { title: space.title, collapsed: true });
  }
  await chrome.tabs.remove(blank);
});
