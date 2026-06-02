# Gift fallback animation prototype — verdict

**Question:** when a gift has no Gift Animation Asset (`.mp4`), how should the celebration
fall back to animating the static Gift Icon (`giftImageUrl` `.png`), reusing the
issue-#57 Triptych geometry?

**Prototype:** `gift-fallback-animation-prototype.html` (throwaway — delete once folded in).

## Locked visual decisions

| Axis | Choice | Why |
|------|--------|-----|
| Gutter motion | **Match** | Gutters pop in sync with the centre icon — reproduces how the real `.mp4` triptych behaves (one clip in all three panes). |
| Icon position | **Center** | Vertically centred in the portrait pane. |
| Particle system | **Fireworks** | Beat radial spark burst; comet-trails was the runner-up. |
| Blast | **Mega** | ~132 particles, widest/​punchiest. |
| Burst height | **Above** | Burst originates just above the icon; gravity rains sparks over it. |
| Colour | **Rainbow** | Per-particle hue around the wheel. |
| Timing | **One shared 2.8s beat** | Icon pop, gutter pop, glow flash and burst all start on the same frame. |

## Locked engineering decisions (CPU)

Particles are a **canvas** engine, kept cheap:
- glow **pre-rendered into 36 hue sprites** (no per-frame `shadowBlur`/gradient — the real cost),
- additive blend (`globalCompositeOperation: 'lighter'`),
- fx canvas at **1×** DPR,
- draw loop **skips between bursts**.

Measured ~120 fps at Mega.

## Architecture (settled via /grill-with-docs → docs updated)

This is **not** a tweak to the existing celebration — it's a new kind. See:
- `CONTEXT.md`: new terms **Synthesized Gift Celebration**, **Animated Gift Celebration**, **Gift Icon**.
- **ADR-0007** (Synthesized Gift Celebration): event-driven trigger, **still anonymous**;
  no-asset detection via a **temporal grace window** (~1–1.5s, since assets carry no `giftId`);
  one fixed ~2.8s cycle then `onEnded`; reuses triptych geometry but **no WebGL split shader**
  (the icon is already RGBA).

## Next step

Fold the locked params into `@celestia/ui` as the Synthesized render path in
`GiftCelebration`, wire the grace-window trigger in the Session Tab, then delete the
prototype + its PNG.
