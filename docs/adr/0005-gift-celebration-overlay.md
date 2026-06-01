# 0005 — Gift Celebration Overlay

**Status:** Accepted

## Context

High-value TikTok gifts ship as short animations. TikTok delivers them as side-by-side (SBS) alpha-packed MP4s: a 1440×1280 frame where the left 720×1280 half is RGB colour and the right 720×1280 half is a luminance alpha matte (white = opaque, black = transparent). The keyed result is a 720×1280 **portrait** with the subject, light beams, and sparkles on transparency.

We want the Session Tab to play a celebration when a `GiftLiveEvent` arrives, attributed to the giver, without disrupting the live feed. This required deciding four things: how to key the asset with correct transparency, how a portrait asset should occupy a **wide desktop** browser tab, how to attribute the giver, and how to handle several gifts arriving at once.

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

### 3. Attribution — giver card reusing GiftEventCard, as a gold pill at mid-⅓

Show who sent the gift by reusing the existing event-feed `GiftEventCard` layout — `[avatar] "<sender> sent a <gift>" [gift image] ×<count>` — with two changes:

- **No timestamp** (the in-feed card's trailing timestamp is dropped).
- **Shinier gold pill:** a fully-rounded capsule (`border-radius: 999px`) with a stronger gold gradient, gold border, gold glow, an inset top highlight, and a slow travelling sheen; tighter padding and a slightly smaller avatar than the in-feed card.

It is pinned to roughly **38% down (the "mid-third")** of the centre portrait frame — within the natural reading path, above the subject's face, off the bright top beams, and over a lit-but-not-busy backdrop for contrast. (Top placement was rejected: it sits outside the reading path and the spotlight beams hurt legibility.)

### 4. Bursts — one celebration at a time, driven by a single queue

Every detected gift animation plays; there is **no value threshold for now**. Celebrations never overlap. A single ordered queue is the source of truth for both playback and the on-screen stack:

- A new gift is appended to the queue. If nothing is playing, the front item starts immediately.
- The front item plays for the clip's natural duration (read from the video's `duration`), then is removed and the next item starts; when the queue empties, the stage is hidden and the feed is fully clear.
- The giver cards render as a stack at the mid-⅓ position: the **playing card is the readable anchor**; waiting cards stack offset behind it, each slightly smaller and dimmer. New cards **fade in**; the finished card **fades up and out** as the queue advances.

## Consequences

- The celebration overlay lives in the `ui` package. Like every `ui` component it takes `GiftLiveEvent`s (which carry the giver `UserInfo` and gift detail) as input and stays platform-agnostic — no Chrome API dependency.
- It reuses, not forks, the `GiftEventCard` layout from the event feed; the gold pill is a styling variant, so giver attribution stays visually consistent with the feed.
- Consistent with v1.0.0: real-time only. Nothing about a celebration is persisted across a Live Session.
- The triptych uses three WebGL contexts. Only on-screen canvases draw, and the stage renders only while a celebration is playing, so an idle feed costs nothing.
- **Deferred to integration:**
  - Sourcing the keyed MP4 per gift (which gifts have assets, and how those assets are fetched and decoded) is a separate concern; "every detected gift animation" means every gift for which we have an asset.
  - Whether to (re)introduce a value threshold for which gifts celebrate.
  - A maximum visible stack depth and a "+N more" affordance, and whether to cap or fast-forward very deep bursts so the overlay does not lag far behind the live moment.
  - Tuning the gutter-echo blur/opacity at production tab widths, and fading the gutter echoes near the end of each clip.
