# 0010 — The Follower Badge reads standing, not presence

**Status:** Accepted — *visual rationale amended 2026-06-07 (see Amendment); merge behaviour extended by ADR-0011*

## Context

ADR-0008 set the Session Tab identity contract: **identity shows where identity is the purpose, and only where the event self-carries it.** It was written because the **Like Layer** *appears* to break the gift-anonymity invariant (ADR-0005, ADR-0007) by rendering liker avatars.

The **Follower Badge** — a green-glass thumbs-up jewel on the top-left of feed avatars, marking viewers who follow the streamer — invites the same double-take. A reviewer who has internalized "the **Gift Celebration** is anonymous" will see a follower marker on a **GiftEventCard** avatar and ask whether it leaks giver identity. It also overlaps, at a glance, the Like Layer's stated job of surfacing **who is loyal**. The *why* is recorded here.

## Decision

The **Follower Badge is consistent with the identity contract, and it is not redundant with the Like Layer** — the two read different axes of loyalty:

- The **Like Layer** reads **presence**: *who is active in the room right now*. It is ephemeral, driven by the live `LikeLiveEvent` stream, and decays as the conveyor advances.
- The **Follower Badge** reads **standing**: *does this viewer follow the streamer*. It is a persistent relationship fact carried on `followStatus`, shown on whoever happens to chat or gift.

The badge satisfies both clauses of the ADR-0008 rule:

- **It self-carries.** `followStatus` rides inline on the event's `UserInfo`, so the badge on a card avatar is *definitionally* a fact about that same already-disclosed viewer — no content-addressed mis-attribution risk of the kind ADR-0005 §3 warned about.
- **Identity is already the surface's purpose.** A **ChatEventCard** / **GiftEventCard** avatar exists to show *who* chatted or gifted; the **GiftEventCard** is the documented source of truth for gift attribution (ADR-0008). The badge only *annotates* an identity the card already disclosed. It never touches the anonymous **Gift Celebration** overlay, which stays pure spectacle.

So the rule generalizes cleanly: **a standing-relationship annotation may ride on any surface that already owns the identity it annotates.**

## Consequences

- The render rule is **binary and silent for non-followers**: `followStatus >= 1` shows the badge (following `1` and mutual `2` treated identically — no friend tier); `0` or `undefined` renders **no DOM node**. Absence is never guessed at, and the silence is load-bearing — it is what lets followers pop pre-attentively in a fast scroll.
- `followStatus` must be plumbed end to end: decoded from `FollowInfo` field 3 (today read and discarded in `tiktok-live.generated.ts`), surfaced on `UserInfo`, and passed through `normalizeUser`. This touches `LiveEvent` normalization and therefore must clear the **live-ingestion contract gate** (`docs/agents/live-ingestion-contract-gate.md`).
- The **"just followed" one-shot is explicitly out of scope for v1.** It is a *transition*, not a standing state, and no live event that reliably carries a follow transition is decoded yet (the `SocialLiveEvent` follow/share discriminator is dropped; the `MemberLiveEvent` `actionId === 2 → 'followed'` mapping is unverified). Wiring it would mean decoding and contract-gating a new event on unverified assumptions. v1 ships standing state only; the transition animation waits until the source event is confirmed against a real stream.

## Considered Options

- **Confine follow-standing to the Like Layer** (no card badge) — keeps loyalty signalling on one surface, but conflates standing with presence and loses follow status for viewers who chat or gift without liking. Rejected: standing and presence are different questions the user wants answered at a glance.
- **Build the friend tier** (amber tint/ring/star for `followStatus === 2`) — prototyped, then cut. The mutual-vs-following distinction is noise for the badge's purpose (spotting followers in a scroll) and dilutes the pre-attentive pop. Rejected.
- **Ship the "just followed" one-shot in v1** — rejected per the Consequences above: no verified transition event to trigger it.

## Amendment (2026-06-07) — the glow was *not* load-bearing; color-block contrast is

The Consequences above claim *"the silence is load-bearing — it is what lets followers pop pre-attentively in a fast scroll,"* and the badge shipped as a **green-glass thumbs-up jewel** (translucent radial fill + border + a three-layer glow `box-shadow` + backdrop-blur + inset highlights). After real use this proved **too distracting while reading the feed** — the bloom drew the eye constantly, not just during a scroll.

Revised: the pre-attentive pop comes from **color-block contrast** (hue + the white thumb glyph against the avatar), **not** from glow. The badge is now a **flat translucent blue disc** (hue 212): glow **off**, border **off**, inset highlight **off**, backdrop-blur **0**. The "green-glass / glassmorphic jewel" framing is retired.

The **"just followed" one-shot (#91)** — which did ship despite being scoped out above — keeps its **pop-in scale** (`jf-pop`) but **loses its glow pulse** (`jf-glow` is deleted), since there is no longer a glow to pulse. A live follow snaps the badge in; it never blooms or throbs.

This amendment changes only the badge's *appearance and motion*, not its *meaning*: it still reads standing, still binary, still silent for non-followers (ADR-0010's thesis stands). The visual values were tuned in a throwaway prototype before being applied.
