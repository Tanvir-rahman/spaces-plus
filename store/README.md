# Publish Spaces Plus to the Chrome Web Store

Everything in this folder is ready. Steps only you can do:

1. Open https://chrome.google.com/webstore/devconsole and sign in with the publisher Google account.
2. First time only: pay the one-time $5 developer fee and accept the developer agreement.
3. Account tab: publisher name AppMotives, contact email support@appmotives.com (verify it). See LISTING.md for trader status.
4. Click "New item" and upload `spaces-plus-4.8.0.zip`.
5. Store listing tab: copy name, summary, description and category from `LISTING.md`.
   Upload `icon128.png` and the five files in `screenshots/` in order 1 to 5, plus the two promo tiles in `promo/`.
6. Privacy tab: copy single purpose, permission reasons, remote code ("No") and data usage from `LISTING.md`.
   Privacy policy URL: https://appmotives.com/spaces-plus/privacypolicy/
7. Distribution tab: Public (or Unlisted to test first), all regions, free.
8. Click "Submit for review". Review usually takes a few days. You get an email when done.

Updates later: bump "version" in manifest.json, zip again, upload on the item's Package tab.
