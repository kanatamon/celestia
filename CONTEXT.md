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
Persistent user configuration that survives across Live Sessions and browser restarts. Stored exclusively in `chrome.storage.local`. Examples: recent streamer username, sound effect volumes, the **Celebration Threshold**, **Reduced Like Motion**. Distinct from Live Session event data, which is never persisted.
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
The kind of **Gift Celebration** built from a static **Gift Icon** for a gift that ships **no** **Gift Animation Asset**. **Event-driven**: triggered by a **GiftLiveEvent** whose unit `diamondCount` meets the **Celebration Threshold**, when no asset is captured within a short grace window. Unlike the **Animated Gift Celebration**, it does **not** use the triptych — the **Gift Icon** is shown centred with **no side gutters**. A **"breathe"** motion animates it (a pop-in, a calm mid-cycle pulse, then a release-up-and-fade exit, so it ends alive rather than vanishing), and a **full-width rainbow particle burst** carries the energy the gutters gave the animated kind. Runs a fixed ~2.8s cycle, then ends. Remains **anonymous** even though its trigger carries identity — the giver is deliberately not shown.
_Avoid_: PNG celebration, fallback animation, image celebration

**Celebration Threshold**:
A **User Preference** — the minimum unit `diamondCount` a gift must be worth for it to earn a **Synthesized Gift Celebration**. Default 99. User-selectable from five discrete tiers: 1, 30, 99, 299, 999 diamonds. Gates *only* the Synthesized kind, never an **Animated Gift Celebration**. Compares the gift's per-unit value, not its streak total.
_Avoid_: Gift threshold, diamond cutoff, min value

**Gift Icon**:
The static gift image carried on a **GiftLiveEvent** as `giftImageUrl` — the small icon TikTok shows for a gift. Identity of the *gift*, not the *giver*. Distinct from a **Gift Animation Asset** (the animated MP4). The source image for a **Synthesized Gift Celebration**.
_Avoid_: Gift image, gift png, gift thumbnail

**Like Layer**:
The canvas overlay on the Session Tab feed that visualizes **LikeLiveEvents**. Unlike a **Gift Celebration**, it deliberately **shows the liker's identity** — here identity *is* the payload, not decoration: the purpose is to let the user notice **who is in the room and who is loyal**. This is not in tension with gift anonymity — a gift's "who sent it" already has a home in the **GiftEventCard** (the source of truth for attribution), so the **Gift Celebration** stays pure spectacle; a Like has no such card, so identity must live in the Like Layer or be lost. Composed of the **Heart Float** and the **Heartbeat Conveyor**, and it triggers the **Like Counter pop**.
_Avoid_: Like overlay, heart canvas, likes animation, like celebration

**Heart Float**:
The glossy pink heart particle of the **Like Layer**. One spawns per like at the right edge of the Activity Bar, balloons vertically upward with a calm sway, then peels off toward the top-left like counter while fading, nudging the counter on arrival. The heart carries only a fixed heart-coloured glow — it does **not** encode the sender (no per-sender hue, no face). "Who liked" is conveyed solely by the **Heartbeat Conveyor**; the heart is pure ambient motion.
_Avoid_: Heart particle, comet, floating heart, like heart

**Heartbeat Conveyor**:
The avatar-only row of recent likers in the **Like Layer**, pinned to the right of the Activity Bar. It advances only on a slow ~1.2s **metronome** (a "heartbeat"): each beat commits the latest unique liker, slides existing avatars left, and fades a newcomer in at the right; the oldest fades off the left. Identity is the **face only** — no nickname text. Its calm comes from **decoupling the visible update rate from the like rate**: it dedupes repeat likers and caps updates to the beat, so it stays restful under a like storm while the **Like Counter** still races.
_Avoid_: Avatar row, liker rail, sender row, conveyor belt

**Like Counter pop**:
The scale-bump of the heart icon + count in the Session Tab **StatusBar** on each like / **Heart Float** arrival. A **StatusBar** behavior the **Like Layer** *triggers* — not part of the canvas overlay. The like *count* is the racing, real-time tally; the pop is its liveness cue.
_Avoid_: Counter bump, like pulse, heart bump

**Reduced Like Motion**:
A **User Preference** (toggle in the settings popover, **default off**) that calms the **Like Layer**. When on: the **Heart Float** and **Like Counter pop** are dropped entirely, and the **Heartbeat Conveyor** swaps faces with a cross-fade instead of the sliding metronome. The like *count* still updates and the liker *faces* still show — only decorative motion is removed, never information. The toggle is the **sole source of truth**; the OS `prefers-reduced-motion` setting is **not** consulted.
_Avoid_: Reduce motion, calm mode, low-motion, accessibility toggle

**ConnectionSignal**:
The three animated signal bars shown beside the streamer username in the Session Tab StatusBar. A purely visual read-out of the current **ConnectionState**, collapsed into five **signal kinds**: `discovering | connected | offline | reconnecting | ended`. Each kind drives the bar colour/motion *and* the username gradient. Distinct from the underlying **ConnectionState** — the signal is the UI projection, not the source of truth.
_Avoid_: Signal bars, status dot, connection indicator

**Connection Advisory**:
The popover that auto-opens over the **ConnectionSignal** when the connection enters a fault the user should be aware of (the `offline` and `reconnecting` signal kinds). Explains *why* it happened and offers a workaround, branching on the **ConnectionState** `reason` (`offline | interrupted | stale`) — three distinct messages. Where the extension can perform the fix itself (`interrupted`, `stale`), it shows a **Reconnect** action; `offline` is informational only and auto-recovers. Anchored on the bars, it auto-opens once per fault episode, is dismissible, can be reopened by clicking the bars, and self-closes on recovery.
_Avoid_: Connection alert, error toast, reconnect dialog, notification

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
The externally observable state of a Provider at any point in time. `status` is one of `idle | attaching | attached | connecting | connected | detaching | disconnecting | detached | disconnected | error`. An `error` status carries a `reason`: `offline` (device lost network), `interrupted` (Chrome Debugger detached — usually the "Celestia is debugging this browser" banner was dismissed), or `stale` (debugger attached but no LiveEvents past the stale threshold). The **ConnectionSignal** projects this onto five UI kinds; the **Connection Advisory** branches on `reason`.
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
- The **Like Layer** in the **Session Tab** visualizes **LikeLiveEvents** and **shows the liker** (avatar + sender-coloured aura) — the opposite identity contract from a **Gift Celebration**, because for a Like identity *is* the payload while a gift's identity lives in its **GiftEventCard**

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
