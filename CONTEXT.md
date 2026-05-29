# Celestia

Celestia is a TikTok Live companion tool that passively observes live stream events and displays them in a real-time feed. It runs as a Chrome extension alongside TikTok's own browser tab — TikTok handles all authentication; Celestia only watches.

## Language

### Product

**Celestia**:
The product. A Chrome extension that shows a real-time TikTok Live companion feed in the browser side panel.
_Avoid_: Ceresia, tiktok-divine-live, the app, the overlay

**Live Session**:
The period from when the user starts observing a TikTok Live stream to when the stream ends or they disconnect. All data in v1.0.0 is scoped to the current Live Session only — nothing persists across sessions.
_Avoid_: Room, broadcast, stream (ambiguous with WebSocket stream)

**Side Panel**:
The Chrome browser side panel that hosts the Celestia UI while the user watches a TikTok Live tab. The Side Panel stays open while the user browses.
_Avoid_: Overlay, popup, extension UI

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
The `@celestia/ui` package. Shared Web UI runtime used by `apps/extension`. Contains React components and associated Web API behaviors (e.g. sound effects). Depends only on `tiktok-live-core` types; no Chrome API dependencies.
_Avoid_: Component library, design system

## Relationships

- **Celestia** renders the **Side Panel** alongside a TikTok tab
- The **Chrome Extension Provider** (in `tiktok-live-chrome-extension`) implements `TikTokLiveProvider` (from `tiktok-live-core`)
- The **Side Panel** (in `apps/extension`) subscribes to **LiveEvents** via a **Provider**
- A **Live Session** produces **LiveEvents**; all **LiveEvents** are discarded when the **Live Session** ends (v1.0.0 — real-time only, no persistence)
- **ui** components receive **LiveEvents** as props; they have no direct dependency on any **Provider**

## Monorepo structure

```
apps/
  extension/       ← Chrome extension app: manifest.json, background service worker, Side Panel React UI
  legacy/          ← Former tiktok-divine-live web app; UI reference only, not deployed, excluded from all tooling pipelines
packages/
  tiktok-live-core/            ← TikTokLiveProvider interface + LiveEvent types
  tiktok-live-chrome-extension/ ← Chrome Debugger API data layer + Chrome Extension Provider
  ui/                          ← Shared React components
```

`apps/legacy` is excluded from linting, type checks, and build pipelines. It exists solely as a UI migration reference and is not deployed.

## Example dialogue

> **Dev:** "Should the Side Panel component read directly from the Chrome Debugger API?"
> **Domain expert:** "No — the Side Panel only knows about LiveEvents and ConnectionState from tiktok-live-core. The Chrome Extension Provider is what talks to the Debugger API. The Side Panel subscribes to the Provider."

> **Dev:** "Do we store chat messages between sessions?"
> **Domain expert:** "No. In v1.0.0 everything is scoped to the current Live Session. When the session ends, the data is gone."

## Flagged ambiguities

- "Ceresia" appeared in early planning — resolved: the product name is **Celestia** everywhere.
- "stream" is overloaded (TikTok live stream vs WebSocket stream vs SSE stream) — prefer **Live Session** for the TikTok broadcast context.
