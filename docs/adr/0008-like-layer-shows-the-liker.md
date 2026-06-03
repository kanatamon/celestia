# 0008 — The Like Layer shows the liker

**Status:** Accepted

## Context

ADR-0005 and ADR-0007 make the **Gift Celebration** strictly **anonymous** — "a reviewer must ensure the giver from the `GiftLiveEvent` never reaches the render path" (ADR-0007 §Consequences). The new **Like Layer** (the canvas overlay that visualizes `LikeLiveEvents` on the Session Tab feed) does the **opposite**: it deliberately renders the liker's avatar in the **Heartbeat Conveyor**. On its face this contradicts the anonymity invariant a reviewer is told to uphold in code, so the *why* is recorded here.

## Decision

The **Like Layer shows the liker; the Gift Celebration does not.** This is not an inconsistency — each surface shows identity exactly when identity is its reason to exist:

- A **gift**'s "who sent it" already has a home: the **GiftEventCard** (`packages/ui/src/event-feed.tsx`) is the single source of truth for gift attribution. The **Gift Celebration** is pure spectacle ("wow, a big gift") — it carries no identity because attribution is the card's job, not the celebration's.
- A **like** has no card. For a like, identity **is** the payload: the purpose of the Like Layer is to let the user notice **who is in the room and who is loyal**. Hiding the liker would gut the feature, not protect it.

So the rule is: **identity shows where identity is the purpose, and only where the event self-carries it.** A `LikeLiveEvent` carries its `user` inline, so the avatar on a Conveyor face is *definitionally* the liker — there is no burst mis-attribution risk of the kind ADR-0005 §3 warned about for content-addressed, identity-less Gift Animation Assets.

## Consequences

- The like **stream** (per-event `user`) is routed through a **read-only sink** fed directly from `provider.onEvent` (mirroring `observeGiftForSynthesis` in `session-tab.tsx`), **bypassing the live-event store entirely**. The store stays count-only; the liker stream is **never written to `chrome.storage.session`**. This keeps the identity-bearing data even more ephemeral than gift data (which *is* stored) — consistent with ADR-0002's real-time-only stance. A side effect: the Heartbeat Conveyor does not survive a component remount; it rebuilds from the live stream.
- Anonymity for gifts and identity-disclosure for likes are now **both explicit, documented invariants** living side by side in one Session Tab. The Like Layer render path is *expected* to receive and show `user`; the Gift Celebration render path is *expected* never to.
- Only the **Heartbeat Conveyor** discloses identity (the face). The **Heart Float** deliberately encodes **no** sender (no per-sender hue, no face) — it is pure ambient motion. "Who liked" is conveyed solely by the Conveyor.

## Considered Options

- **Anonymous likes** (no avatars, count + hearts only) — internally consistent with gift anonymity, but discards the entire point of the feature: noticing who is present and loyal. Rejected.
- **Attributed Gift Celebration** (show the giver too, for symmetry) — already rejected by ADR-0007 §Considered Options; reintroduces burst mis-attribution and duplicates what the GiftEventCard already owns.
