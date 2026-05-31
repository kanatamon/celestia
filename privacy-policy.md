# Privacy Policy

**Celestia — TikTok Live Companion**
Last updated: 2026-05-31

## Overview

Celestia is a Chrome extension that displays a real-time TikTok Live event feed in a dedicated browser tab. This policy explains what data Celestia accesses, how it is used, and what is never collected.

## Data We Access

### TikTok Live tab URLs and titles
Celestia reads the URL and title of open browser tabs solely to identify which tabs are active TikTok Live streams. This powers the Launcher — the popup that lists your open TikTok Live tabs. Tab data is never stored, transmitted, or shared.

### Live stream event data (chat, gifts, viewer counts)
Celestia attaches the Chrome Debugger API to the TikTok Live tab you explicitly select in order to observe the WebSocket connection TikTok establishes. This is the only mechanism Chrome provides to intercept live stream events from an existing tab. All event data (chat messages, gifts, viewer counts, likes, member joins) is displayed in real time and **discarded when the Live Session ends**. It is never written to disk, never sent to any server, and never shared with any third party.

### User Preferences
Celestia stores two pieces of information locally on your device using `chrome.storage.local`:
- The most recently entered streamer username (to pre-fill the Launcher input)
- Sound effect volume levels

This data never leaves your device.

### Tab Pairing Registry
Celestia uses `chrome.storage.session` to remember which TikTok Live tabs already have an open Session Tab, preventing duplicates. This data is cleared automatically when the browser closes.

## Data We Do Not Collect

- We do not collect, store, or transmit any personal information.
- We do not have a backend server. There is no account, login, or sign-up.
- We do not use analytics, crash reporting, or any third-party tracking.
- We do not collect TikTok credentials or authentication tokens.
- We do not share any data with any third party.

## Permissions

| Permission | Purpose |
|---|---|
| `debugger` | Observe the TikTok Live WebSocket stream in the user-selected tab |
| `storage` | Persist user preferences and the tab pairing registry locally |
| `tabs` | Identify TikTok Live tabs and manage Session Tab lifecycle |

## Data Retention

All live stream event data is ephemeral — it exists only in memory while a Live Session is active and is discarded when the session ends. User Preferences persist in `chrome.storage.local` until you uninstall the extension or clear extension storage.

## Changes to This Policy

If this policy changes materially, the "Last updated" date above will be updated. Continued use of the extension after changes constitutes acceptance of the revised policy.

## Contact

If you have questions about this privacy policy, please open an issue at [github.com/kanatamon/celestia](https://github.com/kanatamon/celestia).
