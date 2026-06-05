# 0010 — The Follower Badge reads standing, not presence

**Status:** Accepted

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
