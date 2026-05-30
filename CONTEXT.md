# Celestia

Celestia is a TikTok Live companion tool that passively observes live stream events and displays them in a real-time feed. It runs as a Chrome extension that opens a dedicated browser tab alongside a TikTok Live tab — TikTok handles all authentication; Celestia only watches.

## Language

### Product

**Launcher**:
The Chrome action popup that appears when the user clicks the Celestia toolbar icon. Shows active TikTok Live tabs the user has open and lets the user open a new one by username. Each selection opens or focuses a Session Tab.
_Avoid_: Popup, quick panel, extension popup

**Celestia**:
The product. A Chrome extension that shows a real-time TikTok Live companion feed in a dedicated browser tab paired to a TikTok Live tab.
_Avoid_: Ceresia, tiktok-divine-live, the app, the overlay

**Live Session**:
The period from when the user starts observing a TikTok Live stream to when the stream ends or they disconnect. Live Session event data (chat, gifts, viewer counts) is ephemeral — discarded when the session ends, never written to persistent storage.
_Avoid_: Room, broadcast, stream (ambiguous with WebSocket stream)

**User Preferences**:
Persistent user configuration that survives across Live Sessions and browser restarts. Stored exclusively in `chrome.storage.local`. Examples: recent streamer username, sound effect volumes. Distinct from Live Session event data, which is never persisted.
_Avoid_: Settings, config, localStorage

**Session Tab**:
The dedicated browser tab opened by Celestia to host its UI for a single Live Session. Each Session Tab is paired to exactly one TikTok Live tab; each TikTok Live tab has at most one Session Tab.
_Avoid_: Side panel, overlay, popup, extension UI, new tab

**Tab Pairing Registry**:
The map of `tiktokTabId → sessionTabId` maintained by the service worker in `chrome.storage.session`. Consulted by the Launcher to determine whether a TikTok Live tab already has a Session Tab. Cleared automatically when the browser closes, since Chrome tab IDs do not survive restarts.
_Avoid_: Pairing map, session map, tab registry

### Data layer

**Provider**:
An implementation of `TikTokLiveProvider` that connects to a TikTok Live stream and emits `LiveEvents`. The only Provider in v1.0.0 is the Chrome Extension Provider.
_Avoid_: Connector, service, client

**Chrome Extension Provider**:
The v1.0.0 concrete Provider. Attaches to a user-selected TikTok tab via the Chrome Debugger API, discovers the live-event WebSocket, decodes protobuf frames, and emits normalized LiveEvents.
_Avoid_: CDP provider, debugger provider

**LiveEvent**:
A normalized, typed event emitted by a Provider during a Live Session. Covers chat messages, gifts, viewer count updates, likes, and member joins.
_Avoid_: Event (too generic), WebSocket message, TikTok event

**ConnectionState**:
The externally observable state of a Provider at any point in time: `idle | connecting | connected | disconnecting | disconnected | error`.
_Avoid_: Status, connection status

### Monorepo packages

**tiktok-live-core**:
The `@celestia/tiktok-live-core` package. Pure TypeScript, zero platform dependencies. Owns the `TikTokLiveProvider` interface, `ConnectionState`, `LiveEvent` union, and all shared value types. No Provider implementation lives here.
_Avoid_: Core package, types package, shared package

**tiktok-live-chrome-extension**:
The `@celestia/tiktok-live-chrome-extension` package. Chrome-extension-specific data layer: Chrome Debugger API integration, WebSocket discovery, protobuf decode pipeline, and the Chrome Extension Provider implementation.
_Avoid_: Extension package, CDP package

**ui**:
The `@celestia/ui` package. Shared Web UI runtime used by `apps/chrome-extension`. Contains React components and associated Web API behaviors (e.g. sound effects). Depends only on `tiktok-live-core` types; no Chrome API dependencies.
_Avoid_: Component library, design system

## Relationships

- **Celestia** opens a **Session Tab** paired to a TikTok Live tab
- The **Chrome Extension Provider** (in `tiktok-live-chrome-extension`) implements `TikTokLiveProvider` (from `tiktok-live-core`)
- The **Session Tab** (in `apps/chrome-extension`) subscribes to **LiveEvents** via a **Provider**
- A **Live Session** produces **LiveEvents**; all **LiveEvents** are discarded when the **Live Session** ends (v1.0.0 — real-time only, no persistence)
- **ui** components receive **LiveEvents** as props; they have no direct dependency on any **Provider**

## Monorepo structure

```
apps/
  chrome-extension/  ← Chrome extension app: manifest.json, background service worker, Launcher, Session Tab React UI
  legacy/          ← Former tiktok-divine-live web app; UI reference only, not deployed, excluded from all tooling pipelines
packages/
  tiktok-live-core/            ← TikTokLiveProvider interface + LiveEvent types
  tiktok-live-chrome-extension/ ← Chrome Debugger API data layer + Chrome Extension Provider
  ui/                          ← Shared React components
```

`apps/legacy` is excluded from linting, type checks, and build pipelines. It exists solely as a UI migration reference and is not deployed.

## Example dialogue

> **Dev:** "Should the Session Tab component read directly from the Chrome Debugger API?"
> **Domain expert:** "No — the Session Tab only knows about LiveEvents and ConnectionState from tiktok-live-core. The Chrome Extension Provider is what talks to the Debugger API. The Session Tab subscribes to the Provider."

> **Dev:** "Do we store chat messages between sessions?"
> **Domain expert:** "No. In v1.0.0 everything is scoped to the current Live Session. When the session ends, the data is gone."

## Flagged ambiguities

- "Ceresia" appeared in early planning — resolved: the product name is **Celestia** everywhere.
- "stream" is overloaded (TikTok live stream vs WebSocket stream vs SSE stream) — prefer **Live Session** for the TikTok broadcast context.
