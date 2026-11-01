# 0014 — Update notice

- **Status:** Accepted by Chris, November 1, 2026
- **Spec:** SPEC §2 ("Offline"), §10; BUILD_PLAN M5

## Decision

When a new version of the app has downloaded in the background, Home shows a slim bar above its bottom buttons: **Updated, tap to reload**. Tapping it loads the new version.

The bar is hidden while the CHW is in the middle of an entry: an entry is being entered or edited (a saved draft), or a timer is running. It appears once the entry is saved or the timer is stopped. The app never reloads by itself while the CHW is using it.

If the app is fully closed before the CHW taps the bar, the new version simply loads the next time it opens.

## Why

The spec says the app works offline but not how a new version reaches the phone. Home is where the CHW lands between entries, so a reload there never interrupts work.
