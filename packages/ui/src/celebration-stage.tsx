import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
	type CelebrationQueueState,
	initialCelebrationQueueState,
	reduceCelebrationQueue,
} from './celebration-queue.js';
import { GiftCelebration } from './gift-celebration.js';

/** A freshly captured Gift Animation Asset bound to a Session-Tab object URL. */
export interface CapturedCelebration {
	/** Content hash of the asset; identical gifts share an id. */
	assetId: string;
	/** Object URL minted for this capture; revoked when the asset is done or dropped. */
	assetUrl: string;
}

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

const defaultOnPlay = (onEnded: () => void, assetUrl: string): ReactNode => (
	<GiftCelebration key={assetUrl} assetUrl={assetUrl} onEnded={onEnded} />
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

	// assetId -> object URL for every asset currently in the queue (playing/waiting).
	const urlByAssetId = useRef(new Map<string, string>());
	// The last capture reference we ingested, to dedupe re-renders.
	const lastIngestedRef = useRef<CapturedCelebration | undefined>(undefined);

	// Reclaim any still-owned object URLs when the stage unmounts.
	useEffect(() => {
		const urls = urlByAssetId.current;
		return () => {
			for (const url of urls.values()) {
				URL.revokeObjectURL(url);
			}
			urls.clear();
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

		if (assetIsRetained(next, capture.assetId) && !urlByAssetId.current.has(capture.assetId)) {
			// Accepted into the queue (started or enqueued): remember its URL.
			urlByAssetId.current.set(capture.assetId, capture.assetUrl);
		} else {
			// Coalesced into an existing run, or dropped past the cap: this URL will
			// never play, so reclaim it now.
			URL.revokeObjectURL(capture.assetUrl);
		}

		setQueue(next);
		onCaptureIngested?.();
	}, [capture, onCaptureIngested]);

	const handleClipEnded = useCallback(() => {
		const finished = queueRef.current.playing?.assetId;
		if (finished) {
			const finishedUrl = urlByAssetId.current.get(finished);
			if (finishedUrl) {
				URL.revokeObjectURL(finishedUrl);
				urlByAssetId.current.delete(finished);
			}
		}
		setQueue(reduceCelebrationQueue(queueRef.current, { kind: 'clipEnded' }));
		onClipEnded?.();
	}, [onClipEnded]);

	const playingAssetId = queue.playing?.assetId;
	if (!playingAssetId) {
		return null;
	}

	const playingUrl = urlByAssetId.current.get(playingAssetId);
	if (!playingUrl) {
		return null;
	}

	if (onPlay) {
		return onPlay(handleClipEnded, playingAssetId);
	}
	return defaultOnPlay(handleClipEnded, playingUrl);
}

function assetIsRetained(state: CelebrationQueueState, assetId: string): boolean {
	if (state.playing?.assetId === assetId) {
		return true;
	}
	return state.waiting.some((item) => item.assetId === assetId);
}
