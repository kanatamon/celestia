import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
	type CelebrationQueueState,
	initialCelebrationQueueState,
	reduceCelebrationQueue,
} from './celebration-queue.js';
import { GiftCelebration } from './gift-celebration.js';

/**
 * An **Animated** capture (ADR-0005): a Gift Animation Asset bound to a
 * Session-Tab object URL. The URL is owned by `CelebrationStage` and revoked
 * once the asset is done, dropped, or coalesced.
 */
export interface AnimatedCapturedCelebration {
	kind: 'animated';
	/** Content hash of the asset; identical gifts share an id. */
	assetId: string;
	/** Object URL minted for this capture; revoked when the asset is done or dropped. */
	assetUrl: string;
}

/**
 * A **Synthesized** capture (ADR-0007): a remote **Gift Icon** URL animated in
 * place of an absent Gift Animation Asset. The URL is remote and shared, so it
 * is **never revoked** by `CelebrationStage`.
 */
export interface SynthesizedCapturedCelebration {
	kind: 'synthesized';
	/** Queue key; identical consecutive icons share an id so a run coalesces. */
	assetId: string;
	/** Remote Gift Icon URL (`giftImageUrl`); never minted, never revoked. */
	giftImageUrl: string;
}

/**
 * A captured Gift Celebration, of one of two kinds. Both flow through the same
 * one-at-a-time bounded queue (`reduceCelebrationQueue`, keyed by `assetId`);
 * the kind only governs the stage's URL lifecycle and the render path.
 */
export type CapturedCelebration = AnimatedCapturedCelebration | SynthesizedCapturedCelebration;

export interface CelebrationStageProps {
	/**
	 * The latest captured asset. Each distinct object reference is ingested once
	 * into the celebration queue; pass `undefined` (or repeat a reference) to
	 * ingest nothing.
	 */
	capture?: CapturedCelebration;
	/** Called whenever a celebration finishes playing (after its URL is revoked). */
	onClipEnded?: () => void;
	/**
	 * Called once after each distinct `capture` has been ingested into the queue
	 * (whether it started, was enqueued, coalesced, or dropped). Lets the feeder
	 * release the next buffered capture so a synchronous burst is not collapsed
	 * into a single render.
	 */
	onCaptureIngested?: () => void;
	/**
	 * Test seam: wires the playing clip's natural end. Receives the `onEnded`
	 * callback and the playing `assetId`. Defaults to driving the rendered
	 * `GiftCelebration`'s `onEnded`.
	 */
	onPlay?: (onEnded: () => void, assetId: string) => ReactNode;
}

const defaultOnPlay = (onEnded: () => void, capture: CapturedCelebration): ReactNode =>
	capture.kind === 'synthesized' ? (
		<GiftCelebration key={capture.assetId} giftImageUrl={capture.giftImageUrl} onEnded={onEnded} />
	) : (
		<GiftCelebration key={capture.assetUrl} assetUrl={capture.assetUrl} onEnded={onEnded} />
	);

export function CelebrationStage({
	capture,
	onClipEnded,
	onCaptureIngested,
	onPlay,
}: CelebrationStageProps) {
	const [queue, setQueue] = useState<CelebrationQueueState>(initialCelebrationQueueState);

	// Latest committed queue, mirrored into a ref so the ingest effect and the
	// clip-end handler can compute the next state and perform their object-URL
	// side effects OUTSIDE the `setQueue` updater. State updaters must be pure:
	// React double-invokes them under StrictMode, which would otherwise revoke an
	// object URL twice (once for the URL we just stored) and kill playback.
	const queueRef = useRef(queue);
	queueRef.current = queue;

	// assetId -> capture for every asset currently in the queue (playing/waiting).
	// The capture carries its kind, so the stage knows what to render and — for
	// animated captures only — which object URL to revoke when it retires.
	const captureByAssetId = useRef(new Map<string, CapturedCelebration>());
	// The last capture reference we ingested, to dedupe re-renders.
	const lastIngestedRef = useRef<CapturedCelebration | undefined>(undefined);

	// Reclaim any still-owned object URLs when the stage unmounts. Synthesized
	// captures carry a remote Gift Icon URL that the stage never owns, so they
	// are skipped (revoking a non-blob URL is a no-op, but we never touch them).
	useEffect(() => {
		const captures = captureByAssetId.current;
		return () => {
			for (const owned of captures.values()) {
				revokeIfOwned(owned);
			}
			captures.clear();
		};
	}, []);

	useEffect(() => {
		if (!capture || capture === lastIngestedRef.current) {
			return;
		}
		lastIngestedRef.current = capture;

		const next = reduceCelebrationQueue(queueRef.current, {
			kind: 'assetCaptured',
			assetId: capture.assetId,
		});

		if (assetIsRetained(next, capture.assetId) && !captureByAssetId.current.has(capture.assetId)) {
			// Accepted into the queue (started or enqueued): remember it.
			captureByAssetId.current.set(capture.assetId, capture);
		} else {
			// Coalesced into an existing run, or dropped past the cap: this capture
			// will never play, so reclaim its object URL now (no-op if synthesized).
			revokeIfOwned(capture);
		}

		setQueue(next);
		onCaptureIngested?.();
	}, [capture, onCaptureIngested]);

	const handleClipEnded = useCallback(() => {
		const finished = queueRef.current.playing?.assetId;
		if (finished) {
			const finishedCapture = captureByAssetId.current.get(finished);
			if (finishedCapture) {
				revokeIfOwned(finishedCapture);
				captureByAssetId.current.delete(finished);
			}
		}
		setQueue(reduceCelebrationQueue(queueRef.current, { kind: 'clipEnded' }));
		onClipEnded?.();
	}, [onClipEnded]);

	const playingAssetId = queue.playing?.assetId;
	if (!playingAssetId) {
		return null;
	}

	const playingCapture = captureByAssetId.current.get(playingAssetId);
	if (!playingCapture) {
		return null;
	}

	if (onPlay) {
		return onPlay(handleClipEnded, playingAssetId);
	}
	return defaultOnPlay(handleClipEnded, playingCapture);
}

/**
 * Revokes a capture's object URL only when the stage owns it. Animated captures
 * mint a Session-Tab object URL; synthesized captures carry a remote, shared
 * Gift Icon URL that the stage must never revoke (ADR-0007 §D).
 */
function revokeIfOwned(capture: CapturedCelebration): void {
	if (capture.kind === 'animated') {
		URL.revokeObjectURL(capture.assetUrl);
	}
}

function assetIsRetained(state: CelebrationQueueState, assetId: string): boolean {
	if (state.playing?.assetId === assetId) {
		return true;
	}
	return state.waiting.some((item) => item.assetId === assetId);
}
