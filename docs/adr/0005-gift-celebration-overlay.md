# 0005 — Gift Celebration Overlay

**Status:** Accepted (revised 2026-06-01 — see Revision history)

## Context

High-value TikTok gifts ship as short animations. TikTok delivers them as side-by-side (SBS) alpha-packed MP4s: a 1440×1280 frame where the left 720×1280 half is RGB colour and the right 720×1280 half is a luminance alpha matte (white = opaque, black = transparent). The keyed result is a 720×1280 **portrait** with the subject, light beams, and sparkles on transparency.

We want the Session Tab to play a **Gift Celebration** when a **Gift Animation Asset** is captured, without disrupting the live feed. How that asset is captured is a separate decision — see **ADR-0006 (Gift Animation Tap)**. This ADR decides the *celebration* itself: how to key the asset with correct transparency, how a portrait asset should occupy a **wide desktop** browser tab, whether/how to attribute the giver, and how to handle several animations arriving at once.

## Decision

### 1. Keying — WebGL split shader, straight alpha, over an un-blurred feed

Composite the SBS MP4 on a transparent WebGL canvas layered over the feed. The fragment shader samples the left half for colour and the right half's red channel for alpha:

```glsl
float hw = 0.5;                                   // half-width of the SBS texture
vec3  rgb = texture2D(tex, vec2(uv.x*hw,      uv.y)).rgb;
float a   = texture2D(tex, vec2(uv.x*hw + hw, uv.y)).r;
gl_FragColor = vec4(rgb, a);                      // straight (non-premultiplied) alpha
```

The context is created with `premultipliedAlpha: false` and `alpha: true`, with `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`, so the straight-alpha output blends correctly over the live HTML feed. The frame is uploaded each tick with `texImage2D(..., video)`.

The feed underneath is **never blurred or dimmed**. The keyed transparency is what keeps the feed readable — the subject and beams paint, everything else lets the feed show through. (Implementation note: `half` is a reserved word in GLSL; name the half-width something else, e.g. `hw`.)

### 2. Placement — triptych, full-bleed over the desktop tab

A single 720×1280 portrait centred on a wide tab leaves large empty side gutters and reads like a stranded phone video. Instead, render the keyed portrait three times:

- **Centre:** one copy at natural aspect, `object-fit: contain`, full height, z-index 2.
- **Gutters:** two copies, each ~42% of the body width, `object-fit: cover`, pushed ~6% off the left and right edges, z-index 1 (behind the centre). The left copy is mirrored (`transform: scaleX(-1)`). Both are blurred (~`blur(10px)`), dimmed (`brightness(0.85)`, `opacity(0.6)`).

The blurred mirrored copies make the gutters read as ambient stage-light spill, so the lit stage appears to span the full width while the feed still shows through the transparent centre. This plays full-bleed over the sharp feed.

### 3. Attribution — none; the Gift Celebration is anonymous

**The celebration shows only the keyed animation. There is no giver card, name, label, or other chrome composited on top.**

A Gift Animation Asset carries **no giver identity**: the captured payload is the decrypted pixels (plus an opaque asset URL), and the asset is content-addressed — **the same file plays for every giver of that gift**. Giver identity exists only in the protobuf `GiftLiveEvent` stream, which the Tap never touches. Attributing a giver would require correlating the asset stream with the `GiftLiveEvent` stream by timing or `giftId` — unvalidated, and unreliable during bursts, where it would **mis-attribute** (a worse, trust-destroying failure than showing nothing). We choose robustness over attribution.

### 4. Bursts — one celebration at a time, bounded queue, freshness over completeness

Celebrations never overlap. A single ordered queue, fed by **Gift Animation Asset captures** (not gift events), is the source of truth for playback:

- A captured asset is appended to the queue; if nothing is playing, the front item starts immediately.
- The front item plays for the clip's natural duration (read from the video's `duration`), then is removed and the next starts; when the queue empties, the stage is hidden and the feed is fully clear.
- **Backpressure:** because Celestia is real-time, freshness beats completeness. Keep the currently-playing clip plus a small bounded queue (current + ~1 waiting). **Coalesce identical consecutive assets** — the same gift yields a byte-identical asset, so a run of the same animation collapses to a single play. **Drop** anything beyond the cap rather than let the overlay lag behind the live moment. Some celebrations will therefore never play — accepted.

There are no on-screen waiting/stacked elements (the giver-card stack is gone with §3); a burst is simply a fresh sequence of full-bleed animations.

## Consequences

- The celebration overlay lives in the `ui` package. Like every `ui` component it is platform-agnostic — no Chrome API dependency. Its input is a **Gift Animation Asset** (renderable bytes / a Session-Tab-minted object URL), **not** a `GiftLiveEvent`.
- It does **not** reuse `GiftEventCard` and shares nothing with the event feed's gift rendering (no card is shown).
- Consistent with v1.0.0: real-time only. Nothing about a celebration is persisted across a Live Session.
- The triptych uses three WebGL contexts. Only on-screen canvases draw, and the stage renders only while a celebration is playing, so an idle feed costs nothing.
- Sourcing the asset (which gifts have assets, how they are captured and decoded, and how bytes reach the Session Tab) is decided in **ADR-0006 (Gift Animation Tap)**.
- Because the asset path carries no value/identity, there is **no value threshold** for which gifts celebrate; the de-facto threshold is "TikTok shipped an animation for this gift." Gifts *without* an animation no longer go uncelebrated — they get a **Synthesized Gift Celebration** built from the Gift Icon; see **ADR-0007**. This ADR's celebration is the **Animated Gift Celebration**.
- **Deferred to integration:** tuning the gutter-echo blur/opacity at production tab widths, and fading the gutter echoes near the end of each clip.

## Revision history

- **2026-06-01 — Asset-driven, anonymous.** Capture research (ADR-0006) showed the animation is obtained from an identity-less, content-addressed asset stream, not from the gift-event stream. Trigger changed from event-driven to **asset-driven**; §3 changed from a giver card to **no attribution**; §4's giver-card stack removed and a bounded-queue/coalesce/drop backpressure policy added; the deferred "reintroduce a value threshold" item is closed (not possible without correlation). §1 and §2 are unchanged from the original.
