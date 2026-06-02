/**
 * Synthesized Gift Celebration trigger (ADR-0007, PRD #66 §A).
 *
 * A pure deep module that decides when to synthesize a Gift Celebration from a
 * static **Gift Icon** for a gift that ships no Gift Animation Asset. It is
 * driven by three event kinds and emits zero or more synthesized captures.
 *
 * Why a temporal grace window rather than a lookup: a Gift Animation Asset is
 * content-addressed and carries **no `giftId`** (ADR-0005 §41), so an arriving
 * asset cannot be correlated to the `GiftLiveEvent` that caused it. So on an
 * armed gift we open a short window; if any asset capture lands before it
 * expires we assume that gift was animated (the asset path owns the
 * celebration) and cancel the oldest pending window; otherwise, on a tick past
 * the deadline, we synthesize from the Gift Icon. Best-effort in mixed bursts —
 * accepted (ADR-0005 §4, freshness over completeness).
 *
 * The arbiter is platform-agnostic and **read-only**: it observes gift events,
 * never mutates the live event store. Its output is just an icon URL; the
 * Session Tab wraps that into a synthesized `CapturedCelebration`. The giver on
 * the `GiftLiveEvent` is deliberately never carried here — anonymity is an
 * invariant enforced in code (ADR-0007 §1).
 */

/** Hardcoded Celebration Threshold for this slice. Configurable preference is #70. */
export const CELEBRATION_DIAMOND_THRESHOLD = 99;

/** Grace window a gift waits for an asset before it synthesizes (~1.2s, ADR-0007 §2). */
export const GRACE_WINDOW_MS = 1200;

/** A gift event observed by the arbiter (a read-only projection of a GiftLiveEvent). */
interface GiftEvent {
	kind: 'giftEvent';
	/** Per-unit diamond value (gift tier), never the streak total. */
	diamondCount: number | undefined;
	/** The static Gift Icon URL (`giftImageUrl`); absent gifts never arm. */
	iconUrl: string | undefined;
	/** Event timestamp; the grace window is measured from here. */
	ts: number;
}

/** A Gift Animation Asset capture; claims the oldest pending window. */
interface AssetCapturedEvent {
	kind: 'assetCaptured';
	ts: number;
}

/** A clock tick; expires any window whose deadline has passed. */
interface TickEvent {
	kind: 'tick';
	now: number;
}

export type SynthesizedTriggerEvent = GiftEvent | AssetCapturedEvent | TickEvent;

/** An armed gift waiting out its grace window. */
interface PendingWindow {
	iconUrl: string;
	/** Absolute time at/after which the window expires and synthesizes. */
	deadline: number;
}

export interface SynthesizedTriggerState {
	/** Open grace windows, oldest first (insertion order). */
	pending: PendingWindow[];
}

/** A synthesized capture: just the Gift Icon URL. No giver, ever. */
export interface SynthesizedCapture {
	iconUrl: string;
}

export interface SynthesizedTriggerResult {
	state: SynthesizedTriggerState;
	emitted: SynthesizedCapture[];
}

export const initialSynthesizedTriggerState: SynthesizedTriggerState = {
	pending: [],
};

export function reduceSynthesizedTrigger(
	state: SynthesizedTriggerState,
	event: SynthesizedTriggerEvent,
	threshold: number = CELEBRATION_DIAMOND_THRESHOLD,
): SynthesizedTriggerResult {
	switch (event.kind) {
		case 'giftEvent':
			return { state: arm(state, event, threshold), emitted: [] };
		case 'assetCaptured':
			return { state: cancelOldest(state), emitted: [] };
		case 'tick':
			return expire(state, event.now);
		default:
			return { state, emitted: [] };
	}
}

function arm(
	state: SynthesizedTriggerState,
	event: GiftEvent,
	threshold: number,
): SynthesizedTriggerState {
	const { diamondCount, iconUrl, ts } = event;

	// Threshold gate: unit value only, and an icon must exist. Missing/0 diamonds
	// (treated as below any threshold) and icon-less gifts never arm.
	if (!iconUrl || diamondCount === undefined || diamondCount < threshold) {
		return state;
	}

	// Coalesce an identical consecutive icon (same gift → same icon) into the
	// most recently armed window, mirroring the queue's coalescing.
	if (state.pending.at(-1)?.iconUrl === iconUrl) {
		return state;
	}

	return {
		pending: [...state.pending, { iconUrl, deadline: ts + GRACE_WINDOW_MS }],
	};
}

function cancelOldest(state: SynthesizedTriggerState): SynthesizedTriggerState {
	if (state.pending.length === 0) {
		return state;
	}
	return { pending: state.pending.slice(1) };
}

function expire(state: SynthesizedTriggerState, now: number): SynthesizedTriggerResult {
	const emitted: SynthesizedCapture[] = [];
	const survivors: PendingWindow[] = [];

	for (const window of state.pending) {
		if (now >= window.deadline) {
			emitted.push({ iconUrl: window.iconUrl });
		} else {
			survivors.push(window);
		}
	}

	if (emitted.length === 0) {
		return { state, emitted };
	}

	return { state: { pending: survivors }, emitted };
}
