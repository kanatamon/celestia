# 0007 — Synthesized Gift Celebration (icon fallback)

**Status:** Accepted (revised 2026-06-03 — see Revision history)

## Context

ADR-0005 makes the **Gift Celebration** strictly **asset-driven**: it plays a **Gift Animation Asset** (a keyed SBS-alpha MP4) and is triggered by the asset's capture, never by a `GiftLiveEvent`. That choice bought **anonymity** for free — the asset stream carries no giver identity, so there is nothing to mis-attribute during bursts.

But **most gifts ship no animation.** TikTok only produces a Gift Animation Asset for higher-value gifts; for everything else the only visual is the static **Gift Icon** (`giftImageUrl`, carried on the `GiftLiveEvent`). Under ADR-0005 those gifts "simply do not celebrate" (ADR-0005 §60, session-tab.tsx). We want them to celebrate too, animating the static icon. (The initial design reused the triptych look; the 2026-06-03 revision replaced it with a centred icon — see §3 and the Revision history.)

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

### 3. Rendering — centred icon, no triptych; "breathe" motion; load-bearing burst

The Synthesized celebration does **not** reuse the triptych. It shows the Gift Icon **centred in the 720×1280 portrait frame with no side gutters**, and the render path differs from the Animated celebration:

- **No triptych gutters.** A Gift Animation Asset is full-bleed 720×1280 art, so the blurred/mirrored `cover` gutters read as ambient stage-light spill and the gutters are opaque enough to hide the feed. A Gift Icon is a small, mostly-**transparent ~square** PNG: `cover`-ing it into a tall gutter just zooms transparency, so the gutters never hide the feed and the icon-echo reads as a meaningless blurred smear. Rather than fake an opaque backdrop (a colour plate + blurred ambient-icon fill was prototyped in `prototype-celebration-parity.html` and **rejected** as artificial), drop the gutters entirely.
- **The burst carries the width.** ADR-0005 §2 rejected a centred-only portrait for the *animated* kind because it reads as "a stranded phone video" with empty gutters. The synthesized kind avoids that **without** gutters: the full-stage **rainbow particle burst** fans across the whole tab and supplies the energy the gutters gave the animated kind. The burst is therefore **load-bearing — not optional — for the synthesized celebration**: without it a centred icon *would* read as stranded.
- **No WebGL split-alpha shader.** The Gift Icon is already a normal RGBA PNG with its own transparency — there is no SBS matte to key. The centre icon is a single DOM image.
- **Motion — the "breathe" lifecycle** (validated by prototype `prototype-celebration-parity.html`): a **pop-in** entrance, a **calm mid-cycle pulse**, then a **release-up-and-fade** exit (the icon scales up slightly and fades out, rather than shrinking to nothing). The old shrink/fade-to-nothing exit read as *dead*; releasing keeps it alive to the end. The earlier "Match" clause (gutters popping in sync with the icon) is **removed** — there are no gutters.
- **Particle burst** rendered on a `<canvas>`. Locked parameters: position **Center**, blast **Mega**, burst origin **Above** the icon, colour **Rainbow**, on the single shared **2.8s** beat.
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
- **Triptych with icon-echo gutters** (the original §3 of this ADR) — reuse the animated kind's two blurred/mirrored/dimmed gutters, filled with the Gift Icon. Rejected on the 2026-06-03 revision: a transparent ~square icon cannot fill a tall gutter convincingly, so the gutters neither hid the feed nor read as ambient spill.
- **Opaque backdrop (plate + ambient-icon fill)** — give the synthesized gutters an opaque colour plate plus a blurred, zoomed icon fill so they hide the feed like the animated gutters. Prototyped in `prototype-celebration-parity.html`; rejected as artificial-looking. Dropping the gutters and leaning on the burst read better.

## Consequences

- Reintroduces an **event-driven** celebration path. The Session Tab now feeds the celebration queue from **two** sources — Gift Animation Asset captures *and* `GiftLiveEvent`s (gated by the grace window) — where ADR-0005 had only the former.
- The `ui` celebration component gains a second, non-WebGL render path for the synthesized kind; it stays platform-agnostic (its input is a Gift Icon URL + the icon's intrinsic motion, no Chrome APIs).
- Anonymity is now an **explicit invariant** to uphold in code, not a property guaranteed by the data — a reviewer must ensure the giver from the `GiftLiveEvent` never reaches the render path.
- Still real-time only; nothing about a Synthesized celebration is persisted (consistent with v1.0.0). The **Celebration Threshold** itself *is* persisted — it is a User Preference, not Live Session data.
- Reverses ADR-0005 §60's "no value threshold" **for the Synthesized path only**; the Animated path remains threshold-free.
- ADR-0005 is **not** superseded — its keying, triptych, anonymity, and queue decisions stand for the **Animated** kind. This ADR adds a peer celebration kind alongside it.
- The two kinds now **diverge in layout**: the Animated kind is a full-bleed triptych; the Synthesized kind is a centred icon framed by its burst. ADR-0005 §2's rejection of a centred-only layout is **scoped to the animated kind only** — it does not apply where a load-bearing burst supplies the width (§3).
- The fireworks burst is **load-bearing** for the Synthesized kind. Disabling/degrading it (e.g. a future "reduce motion" path) cannot simply hide the burst — it must substitute another full-width treatment or the icon will read as stranded.

## Revision history

- **2026-06-03 — Centred icon, no triptych; breathe motion.** Validated by `prototype-celebration-parity.html`. §3 reworked: dropped the triptych gutters for the Synthesized kind (a transparent ~square icon can't fill them; an opaque plate/ambient-fill backdrop was prototyped and rejected as artificial), made the rainbow burst **load-bearing** to carry the width, and replaced the centre icon's pop-in/fade-to-nothing with the **"breathe"** lifecycle (pop-in → mid-cycle pulse → release-up-and-fade) so it ends alive. Removed the "Match" gutter-sync clause. §1, §2, §4, §5 unchanged.
- **2026-06-02 — Initial.** Created after the prototype exploration converged on the Match / Center / Mega / Above / Rainbow canvas-particle treatment.
