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
Persistent user configuration that survives across Live Sessions and browser restarts. Stored exclusively in `chrome.storage.local`. Examples: recent streamer username, sound effect volumes, the **Celebration Threshold**. Distinct from Live Session event data, which is never persisted.
_Avoid_: Settings, config, localStorage

**Session Tab**:
The dedicated browser tab opened by Celestia to host its UI for a single Live Session. Each Session Tab is paired to exactly one TikTok Live tab; each TikTok Live tab has at most one Session Tab.
_Avoid_: Side panel, overlay, popup, extension UI, new tab

**Tab Pairing Registry**:
The map of `tiktokTabId → sessionTabId` maintained by the service worker in `chrome.storage.session`. Consulted by the Launcher to determine whether a TikTok Live tab already has a Session Tab. Cleared automatically when the browser closes, since Chrome tab IDs do not survive restarts.
_Avoid_: Pairing map, session map, tab registry

**Gift Celebration**:
The full-bleed, **anonymous** celebration played over the Session Tab feed when a celebration-worthy gift arrives. Always one-at-a-time through a bounded queue and never shows a giver name, card, or other chrome. Comes in two kinds — an **Animated Gift Celebration** (from a **Gift Animation Asset**) and a **Synthesized Gift Celebration** (from a **Gift Icon** when no asset exists). Rendered by a platform-agnostic `ui` component.
_Avoid_: The overlay, gift card, animation, gift popup

**Animated Gift Celebration**:
The kind of **Gift Celebration** that plays a **Gift Animation Asset** (the keyed SBS-alpha MP4) through the WebGL split-alpha triptych. **Asset-driven**: triggered by asset capture, not by a GiftLiveEvent. Plays for the clip's natural video duration.
_Avoid_: MP4 celebration, video celebration

**Synthesized Gift Celebration**:
The kind of **Gift Celebration** built from a static **Gift Icon** for a gift that ships **no** **Gift Animation Asset**. **Event-driven**: triggered by a **GiftLiveEvent** whose unit `diamondCount` meets the **Celebration Threshold**, when no asset is captured within a short grace window. Reuses the triptych geometry but animates the icon (a pop-in synced with the gutters, plus a canvas particle burst) for a fixed ~2.8s cycle, then ends. Remains **anonymous** even though its trigger carries identity — the giver is deliberately not shown.
_Avoid_: PNG celebration, fallback animation, image celebration

**Celebration Threshold**:
A **User Preference** — the minimum unit `diamondCount` a gift must be worth for it to earn a **Synthesized Gift Celebration**. Default 99; user-adjustable (slider, range 30–50000). Gates *only* the Synthesized kind, never an **Animated Gift Celebration**. Compares the gift's per-unit value, not its streak total.
_Avoid_: Gift threshold, diamond cutoff, min value

**Gift Icon**:
The static gift image carried on a **GiftLiveEvent** as `giftImageUrl` — the small icon TikTok shows for a gift. Identity of the *gift*, not the *giver*. Distinct from a **Gift Animation Asset** (the animated MP4). The source image for a **Synthesized Gift Celebration**.
_Avoid_: Gift image, gift png, gift thumbnail

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

**Gift Animation Asset**:
The decrypted, side-by-side alpha-packed MP4 captured from the TikTok page for an animated gift — left half RGB colour, right half luminance alpha matte. Identity-less and shared by every giver of that gift. Distinct from `giftImageUrl`, the static gift icon carried on a GiftLiveEvent.
_Avoid_: Gift video, the blob, the mp4, gift image

**Gift Animation Tap**:
The capture mechanism that produces Gift Animation Assets: a content-script main-world tap injected into the paired TikTok Live tab that intercepts the decrypted animation as the page creates it, then relays it to the Session Tab. Distinct from a Provider — it emits Gift Animation Assets, not LiveEvents, and carries no identity. Lives in `tiktok-live-chrome-extension`.
_Avoid_: Gift sniffer, asset scraper, gift hook, content script (too generic)

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
- The **Gift Animation Tap** (in **tiktok-live-chrome-extension**) captures **Gift Animation Assets** from the paired TikTok Live tab, independently of any **Provider**
- A **Gift Celebration** in the **Session Tab** is always anonymous and takes one of two forms:
  - an **Animated Gift Celebration** plays a **Gift Animation Asset** (asset-driven; *not* derived from a **GiftLiveEvent**)
  - a **Synthesized Gift Celebration** animates a **Gift Icon** from a **GiftLiveEvent** when no **Gift Animation Asset** is captured within a short grace window (event-driven, but still shows no giver)

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
