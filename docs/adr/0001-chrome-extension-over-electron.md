# Chrome extension over Electron desktop app

PoC confirmed that both an Electron app and a Chrome extension can passively observe TikTok Live WebSocket traffic via CDP. We chose the Chrome extension because the Electron app requires users to log into TikTok through an embedded WebContentsView — making Celestia responsible for detecting and managing TikTok session state. The Chrome extension avoids this entirely: TikTok's own tab handles auth, and the extension observes passively. Distribution is also simpler — install from the Chrome Web Store, no download or system install required.

## Considered options

- **Electron desktop app** — proven by PoC but requires owning TikTok session detection and onboarding through a WebContentsView. Creates liability for a problem TikTok already solves.
- **Chrome extension** — TikTok's own browser tab handles auth. The extension attaches via Chrome Debugger API. No credential handling, no session management, no install friction.

## Consequences

Issues #3 (Desktop Celestia PRD) and the `tiktok-live-electron` portion of Issue #5 are closed. The `@celestia/tiktok-live-electron` package is not built.
