/**
 * Heartbeat Conveyor motion (PRD #79, issue #81).
 *
 * A single pure, clock-injected reducer — `computeConveyor(state, event, now)` —
 * that owns every decision-bearing piece of the **Heartbeat Conveyor**: the
 * avatar-only row of recent likers in the **Like Layer**. It is the calm twin of
 * the racing **Like Counter**: its restfulness comes from **decoupling the
 * visible update rate from the like rate** (CONTEXT.md, Heartbeat Conveyor).
 *
 * The reducer is fed two event kinds:
 *  - `{ kind: 'like', liker }` — a like arrived. It does **not** advance the row;
 *    it only records the **latest** liker as pending. A storm of likes between
 *    two beats collapses to a single pending liker (last writer wins).
 *  - `{ kind: 'beat' }` — the ~1.2s metronome fired. It commits the pending
 *    liker (if any) and clears it:
 *      - a **new** liker is **appended** at the right; if the row is over
 *        `CONVEYOR_CAPACITY` the **oldest on the left is evicted**;
 *      - a **repeat** liker already seated gets a one-shot **breathe** (its
 *        `breatheSeq` bumps) **in place** — no reorder, no new seat — and its
 *        identity payload is refreshed (newest avatar/name wins).
 *
 * Each seat carries a stable `key` minted on first seating, so the DOM renderer
 * can track a seat across beats (slide vs. fade-in vs. breathe) by identity, not
 * position. This module owns *membership and timing*; the renderer owns *space*
 * (the slide/fade pixels). Side-effect-free and platform-agnostic.
 *
 * `now` is accepted for symmetry with the Heart Float motion primitives and to
 * keep the beat decision injectable; the metronome cadence itself is driven by
 * the caller, so the reducer treats every `beat` event as an authoritative tick.
 *
 * Locked tunables (issue #81): `BEAT_MS = 1200`, `CONVEYOR_CAPACITY = 5`.
 */

/** The metronome period in milliseconds (locked). */
export const BEAT_MS = 1200;
/** Max seated avatars; oldest on the left evicted past it (locked, ~5). */
export const CONVEYOR_CAPACITY = 5;

/** The identity payload the Conveyor shows for one liker — the face only. */
export interface ConveyorLiker {
	/** Stable liker identity used for dedupe (TikTok user id / unique id). */
	readonly id: string;
	/** Avatar image URL; may be missing — the renderer falls back to initials. */
	readonly avatarUrl?: string;
	/** Display name, used only for the fallback initial + alt text (never shown as text). */
	readonly name?: string;
}

/** One seated avatar in the row. */
export interface ConveyorSlot {
	/** Stable seat key, minted once on first seating; survives breathes. */
	readonly key: string;
	/** The liker shown in this seat; refreshed (newest wins) on a repeat. */
	readonly liker: ConveyorLiker;
	/**
	 * One-shot breathe counter. Bumps each time an already-seated liker likes
	 * again on a beat, so the renderer can fire a single gentle pulse in place.
	 */
	readonly breatheSeq: number;
}

export interface ConveyorState {
	/** Seated avatars, oldest on the left, newest on the right. */
	readonly slots: readonly ConveyorSlot[];
	/** The latest liker seen since the last beat, awaiting commit; null if none. */
	readonly pending: ConveyorLiker | null;
	/** Monotonic counter minting unique seat keys. */
	readonly nextKey: number;
}

export type ConveyorEvent = { kind: 'like'; liker: ConveyorLiker } | { kind: 'beat' };

/** An empty Conveyor: no seats, nothing pending. */
export const initialConveyorState: ConveyorState = {
	slots: [],
	pending: null,
	nextKey: 1,
};

/**
 * Advance the Conveyor by one event. Pure: returns a new state, never mutates
 * the input. `now` is currently informational (the caller drives the beat); it
 * is part of the signature so the beat decision can move in-reducer later
 * without a breaking change.
 */
export function computeConveyor(
	state: ConveyorState,
	event: ConveyorEvent,
	_now: number,
): ConveyorState {
	if (event.kind === 'like') {
		// A like never advances the row — it only updates the pending latest liker.
		// A storm collapses to one pending entry (last writer wins).
		return { ...state, pending: event.liker };
	}

	// kind === 'beat': commit the pending liker, if any, then clear it.
	if (state.pending === null) {
		return state;
	}
	const pending = state.pending;

	const seatedIndex = state.slots.findIndex((slot) => slot.liker.id === pending.id);
	if (seatedIndex !== -1) {
		// Repeat liker already in the row: breathe in place — no reorder, no new
		// seat. Refresh the identity payload (newest avatar/name wins).
		const slots = state.slots.map((slot, index) =>
			index === seatedIndex ? { ...slot, liker: pending, breatheSeq: slot.breatheSeq + 1 } : slot,
		);
		return { ...state, slots, pending: null };
	}

	// New liker: seat at the right with a fresh stable key.
	const seated: ConveyorSlot = {
		key: `conveyor-${state.nextKey}`,
		liker: pending,
		breatheSeq: 0,
	};
	const appended = [...state.slots, seated];
	// Cap capacity, evicting the oldest on the left.
	const slots =
		appended.length > CONVEYOR_CAPACITY
			? appended.slice(appended.length - CONVEYOR_CAPACITY)
			: appended;

	return { slots, pending: null, nextKey: state.nextKey + 1 };
}
