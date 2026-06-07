# 0011 — The Heart Me badge supersedes the Follower Badge in a shared slot

**Status:** Accepted — *scope narrowed to chat cards 2026-06-07 (see Amendment)*

## Context

ADR-0010 placed the **Follower Badge** on the **top-left** of a feed avatar and reserved the **top-right** for the **Heart Me badge** — the gift icon shown when a viewer has sent the "Heart Me" gift this session. The two were deliberately on opposite corners and described in `CONTEXT.md` as *coexisting*.

In real use, two avatar badges on one small avatar read as clutter, and the coexistence is **logically redundant**: on TikTok, the "Heart Me" gift can be sent **only by a follower, and only once per day**. So a Heart Me sender is, by definition, already a follower — showing both badges says the same thing twice.

## Decision

The **Follower Badge** and the **Heart Me badge** share **one slot** on the avatar's **top-left**, and the **Heart Me badge wins** it:

```
slot = heartMe ? <HeartMeBadge/> : isFollower ? <FollowerBadge/> : null
```

- The two are **mutually exclusive**, never stacked. The Heart Me badge moves from top-right to the shared top-left slot, sized and offset to match the Follower Badge exactly.
- When a viewer has sent Heart Me, the **Follower Badge is suppressed** for that row — the Heart Me badge is the stronger, more specific standing signal and stands in for it.
- We **deliberately do not re-check `followStatus`** when a Heart Me gift is present. A Heart Me gift is treated as a **superset signal**: positive, dated evidence of a follower action, trusted over a `followStatus` that can be stale or absent.

## Consequences

- **We trust a TikTok platform invariant our code does not enforce.** "Heart Me ⟹ follower, once a day" is a platform rule, not something we verify. If TikTok ever lets a non-follower send Heart Me, that viewer would claim the slot without a follower relationship. We accept this knowingly: the once-a-day Heart Me signal is more valuable to surface than the edge-case correctness of gating it, and gating would mean trusting a possibly-stale `followStatus` over direct evidence anyway.
- **The Heart Me badge never animates.** Because it occupies the slot in place of `FollowerBadge`, the `useFollowerPulse` hook does not mount for a Heart Me sender, so the **"just followed" pop (#91) cannot fire** when Heart Me is shown. This is intentional — the pop is a Follower-Badge-only behaviour; the once-a-day Heart Me signal already outranks the transient follow moment, and animating a static gift icon would be noise.
- **Top-right is now free.** ADR-0010's reservation of the top-right corner for the Heart Me badge no longer holds; the corner is unclaimed.
- This is an identity-*precedence* rule layered on top of ADR-0010's standing-vs-presence thesis, which is unaffected. It does **not** touch the anonymous **Gift Celebration** (ADR-0005, ADR-0008) — the Heart Me badge annotates an already-disclosed card identity, exactly as the Follower Badge does.

## Considered Options

- **Keep both badges on opposite corners (the ADR-0010 status quo)** — rejected: clutter on a small avatar, and logically redundant since a Heart Me sender is already a follower.
- **Gate Heart Me on `followStatus`** (show it only if `followStatus >= 1`) — rejected: `followStatus` can be stale or undefined, and a present Heart Me gift is *stronger* evidence of standing than the status field. Gating would suppress a real signal to honour a weaker one.
- **Show the Follower Badge instead when both apply** — rejected: Heart Me is the more specific, more recent, more deliberate signal; demoting it to the generic follower mark loses information.

## Amendment (2026-06-07) — the Heart Me badge is scoped to chat cards

The Decision above places the shared top-left slot on "a feed avatar" generally, and the final Consequence asserts the Heart Me badge annotates a card identity *"exactly as the Follower Badge does"* — implying it rides both the **ChatEventCard** and the **GiftEventCard** avatar.

In practice it only rides the **ChatEventCard**. On a **GiftEventCard** the badge sits on the compact ~30px avatar immediately beside the gift image and the one-line gift sentence; a gift-icon badge tucked against another gift read as crowded and visually ambiguous. So the Heart Me badge is now surfaced on the **ChatEventCard avatar only**. On a **GiftEventCard** the entire standing-badge slot is suppressed — **neither the Heart Me badge nor the Follower Badge renders** (ADR-0010 Amendment 2 drops the Follower Badge from gift cards for the same space reason). The gift card opts out of the slot via `standingBadge={false}` on its `Avatar`.

This is a **layout choice, not a semantic one**: the supersession rule is unchanged where it still applies — on a chat card a present Heart Me gift still wins the shared slot and suppresses the Follower Badge, still without re-checking `followStatus`. The standing-badge slot as a whole is simply a **chat-card surface**; a gift card speaks to the gift, not the giver's standing.
