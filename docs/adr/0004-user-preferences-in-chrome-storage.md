# 0004 — User Preferences in chrome.storage.local

**Status:** Accepted

## Context

The `ui` package's `sound-manager.ts` used `localStorage` to persist sound volume settings. When the Launcher feature introduced a second User Preference (recent streamer username), a unified storage tier was needed. The recent username must be readable from the Launcher (an extension action popup), and sound volume must survive the Session Tab being closed and reopened.

Two options were considered:

- **`localStorage`** — simple browser API, but page-scoped. Inaccessible from the service worker. Each extension page (Launcher, Session Tab) has its own `localStorage` origin partition in some Chrome versions.
- **`chrome.storage.local`** — accessible from all extension contexts (Launcher, Session Tab, service worker), survives page closure, consistent across all extension pages sharing the same extension ID.

## Decision

All User Preferences are stored exclusively in `chrome.storage.local`. `localStorage` is not used for any preference data.

The `ui` package does not call `chrome.storage` directly — it accepts a storage abstraction so it remains free of Chrome API dependencies and testable in isolation.

## Consequences

- `sound-manager.ts` must be updated to accept a storage abstraction rather than calling `localStorage` directly.
- Any new User Preference must be written to `chrome.storage.local`, not `localStorage`.
- The `ui` package stays platform-agnostic; the Chrome-specific storage implementation lives in `apps/chrome-extension`.
