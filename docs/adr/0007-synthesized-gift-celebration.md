# 0007 — Synthesized Gift Celebration (icon fallback)

**Status:** Accepted (2026-06-02)

## Context

ADR-0005 makes the **Gift Celebration** strictly **asset-driven**: it plays a **Gift Animation Asset** (a keyed SBS-alpha MP4) and is triggered by the asset's capture, never by a `GiftLiveEvent`. That choice bought **anonymity** for free — the asset stream carries no giver identity, so there is nothing to mis-attribute during bursts.

But **most gifts ship no animation.** TikTok only produces a Gift Animation Asset for higher-value gifts; for everything else the only visual is the static **Gift Icon** (`giftImageUrl`, carried on the `GiftLiveEvent`). Under ADR-0005 those gifts "simply do not celebrate" (ADR-0005 §60, session-tab.tsx). We want them to celebrate too, reusing the triptych look but animating the static icon.

This is in tension with ADR-0005 on two axes:

1. **Trigger.** No asset is ever captured for these gifts, so an asset-driven trigger can never fire. The only signal is the `GiftLiveEvent` — i.e. the **event-driven** path ADR-0005 deliberately removed.
2. **Identity.** The icon lives on the `GiftLiveEvent`, which *does* carry a giver. The asset path was anonymous because it *had* no identity; here we have identity available and must choose not to use it.

## Decision

Add a second kind of Gift Celebration — the **Synthesized Gift Celebration** — built from the **Gift Icon** when a gift has no Gift Animation Asset. The existing asset path is now the **Animated Gift Celebration**; both are anonymous and share the one-at-a-time bounded queue.

### 1. Event-driven trigger, still anonymous

The Synthesized Gift Celebration is triggered by a `GiftLiveEvent`. **Despite the trigger carrying a giver, no giver name, card, or chrome is shown** — anonymity is preserved by deliberate choice, not by absence of data. This keeps both celebration kinds visually identical in their "no attribution" contract and sidesteps the burst mis-attribution risk that ADR-0005 §3 warned about.

### 2. Detection — temporal grace window

A Gift Animation Asset is identity-less and content-addressed (ADR-0005 §41, ADR-0006): it carries **no `giftId`**, so an arriving asset **cannot be correlated** to the `GiftLiveEvent` that caused it. Detection is therefore **temporal**: on a `GiftLiveEvent`, wait a short grace window (~1–1.5s) for any Gift Animation Asset capture. If one arrives, the asset path owns the celebration; if none arrives, synthesize one from the Gift Icon.

This is **best-effort**. In a mixed burst (animated and non-animated gifts interleaved) the window may occasionally suppress a synthesized celebration or let a redundant one through. That is accepted, consistent with ADR-0005 §4's *freshness over completeness* stance.

### 3. Rendering — reuse the triptych geometry, animate the icon

Reuse the ADR-0005 §2 triptych geometry (centre `contain`, two ~42% blurred/mirrored/dimmed `cover` gutters, 720×1280 portrait frame). The render path differs from the Animated celebration:

- **No WebGL split-alpha shader.** The Gift Icon is already a normal RGBA PNG with its own transparency — there is no SBS matte to key. The centre and gutters draw the icon directly (the gutters as blurred CSS backgrounds; the icon as a DOM image).
- **Motion** (validated by prototype `gift-fallback-animation-prototype.html`): a pop-in on the centre icon, the **gutters popping in sync** with it ("Match"), and a **particle burst** rendered on a `<canvas>`. Locked parameters: position **Center**, blast **Mega**, burst origin **Above** the icon, colour **Rainbow**, all on a single shared **2.8s** beat.
- **Cheap by construction.** The particle glow is **pre-rendered once into hue sprites** (no per-frame `shadowBlur`/gradient — the real CPU cost), drawn additively (`globalCompositeOperation: 'lighter'`), on a **1× canvas**, and the draw loop **skips entirely between bursts**. Measured ~120 fps at the Mega count (~132 particles).

### 4. Duration — one fixed cycle

A PNG has no natural duration. The Synthesized celebration runs **exactly one ~2.8s pop-in + burst cycle**, then fires `onEnded` — plugging into the existing `CelebrationStage` queue (`reduceCelebrationQueue` `clipEnded`) the same way a video's `ended` event does. Coalescing/backpressure (ADR-0005 §4) carry over unchanged.

### 5. Gating — configurable diamond threshold (Synthesized only)

ADR-0005 §60 declared **no value threshold** — but that was because the *asset* path carries no value. The Synthesized path is event-driven, so the `GiftLiveEvent`'s `diamondCount` *is* available, and celebrating every icon-only gift would be noise. So a **Synthesized Gift Celebration only fires when the gift's unit `diamondCount` ≥ a threshold.**

- **Unit, not streak.** Compare the gift's per-unit `diamondCount` (its tier), **not** `diamondCount × repeatCount`. A long combo of a cheap gift never qualifies.
- **Missing/0 diamonds → never synthesize.** Unknown-value gifts are treated as below any threshold.
- **Synthesized only.** The threshold never gates an **Animated Gift Celebration** (those have no `diamondCount` and are already high-value) — ADR-0005's "no threshold on the asset path" stands.
- **User-configurable.** The threshold is a **User Preference** (`chrome.storage.local`), surfaced as a slider in the settings popover. **Default 99**, range **30–50000**. As detection only needs to arm the grace window for above-threshold gifts, the threshold is checked *before* the window is started.

## Considered Options

- **Curated `giftId` allowlist** of which gifts ship animations — deterministic, but must be built and maintained, and goes stale as TikTok changes gifts. Rejected.
- **Attributed synthesized celebration** (show the giver, since the event has identity) — reverses ADR-0005 §3 wholesale and reintroduces burst mis-attribution. Rejected.
- **All-PNG** (drop the MP4 path) — throws away the high-fidelity animated celebration. Rejected.
- **No fallback** (status quo) — leaves the large majority of gifts with no celebration. Rejected; this ADR exists to fix that.

## Consequences

- Reintroduces an **event-driven** celebration path. The Session Tab now feeds the celebration queue from **two** sources — Gift Animation Asset captures *and* `GiftLiveEvent`s (gated by the grace window) — where ADR-0005 had only the former.
- The `ui` celebration component gains a second, non-WebGL render path for the synthesized kind; it stays platform-agnostic (its input is a Gift Icon URL + the icon's intrinsic motion, no Chrome APIs).
- Anonymity is now an **explicit invariant** to uphold in code, not a property guaranteed by the data — a reviewer must ensure the giver from the `GiftLiveEvent` never reaches the render path.
- Still real-time only; nothing about a Synthesized celebration is persisted (consistent with v1.0.0). The **Celebration Threshold** itself *is* persisted — it is a User Preference, not Live Session data.
- Reverses ADR-0005 §60's "no value threshold" **for the Synthesized path only**; the Animated path remains threshold-free.
- ADR-0005 is **not** superseded — its keying, triptych, anonymity, and queue decisions stand. This ADR adds a peer celebration kind alongside it.

## Revision history

- **2026-06-02 — Initial.** Created after the `gift-fallback-animation-prototype.html` exploration converged on the Match / Center / Mega / Above / Rainbow canvas-particle treatment.
