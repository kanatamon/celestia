/**
 * Celebration queue + backpressure (ADR-0005 §4).
 *
 * A pure reducer that sequences Gift Celebrations so exactly one plays at a
 * time. Because Celestia is real-time, freshness beats completeness: the queue
 * keeps the playing clip plus a small bounded run of waiting assets, coalesces
 * identical consecutive assets (the same gift yields a byte-identical asset, so
 * `assetId` is its content hash), and drops anything beyond the cap. Some
 * captured celebrations will therefore never play — accepted.
 */

/** Maximum number of waiting assets behind the playing one. */
export const CELEBRATION_QUEUE_WAITING_CAP = 1;

interface QueuedCelebration {
	/** Content hash of the Gift Animation Asset; identical assets share an id. */
	assetId: string;
}

export interface CelebrationQueueState {
	playing?: QueuedCelebration;
	waiting: QueuedCelebration[];
}

export type CelebrationEvent = { kind: 'assetCaptured'; assetId: string } | { kind: 'clipEnded' };

export const initialCelebrationQueueState: CelebrationQueueState = {
	playing: undefined,
	waiting: [],
};

export function reduceCelebrationQueue(
	state: CelebrationQueueState,
	event: CelebrationEvent,
): CelebrationQueueState {
	switch (event.kind) {
		case 'assetCaptured':
			return appendCapturedAsset(state, event.assetId);
		case 'clipEnded':
			return advance(state);
		default:
			return state;
	}
}

function appendCapturedAsset(state: CelebrationQueueState, assetId: string): CelebrationQueueState {
	// Nothing playing yet: start immediately.
	if (!state.playing) {
		return { playing: { assetId }, waiting: [] };
	}

	// Coalesce a run of the same asset into a single play.
	if (lastEnqueuedAssetId(state) === assetId) {
		return state;
	}

	// Bounded queue: drop the freshest capture rather than let the stage lag.
	if (state.waiting.length >= CELEBRATION_QUEUE_WAITING_CAP) {
		return state;
	}

	return { playing: state.playing, waiting: [...state.waiting, { assetId }] };
}

function advance(state: CelebrationQueueState): CelebrationQueueState {
	const [next, ...rest] = state.waiting;
	return { playing: next, waiting: rest };
}

function lastEnqueuedAssetId(state: CelebrationQueueState): string | undefined {
	const lastWaiting = state.waiting.at(-1);
	return lastWaiting?.assetId ?? state.playing?.assetId;
}
