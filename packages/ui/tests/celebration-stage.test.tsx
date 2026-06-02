import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CelebrationStage } from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

/**
 * Captures the latest `onEnded` handler that `CelebrationStage` wires into the
 * playing `GiftCelebration`, so a test can fire a natural clip-end without a
 * real <video> (WebGL is mocked out under jsdom).
 */
function makeClipEndDriver() {
	let latestOnEnded: (() => void) | undefined;
	const onPlay = vi.fn((onEnded: () => void) => {
		latestOnEnded = onEnded;
		return null;
	});
	return {
		onPlay,
		endClip() {
			if (!latestOnEnded) {
				throw new Error('Expected a celebration to be playing');
			}
			latestOnEnded();
		},
	};
}

describe('CelebrationStage', () => {
	// Every case mounts under <StrictMode> (createStrictRoot) so React's dev-only
	// double-invoke of render / state updaters / mount effects exercises the same
	// impurity surface the Session Tab hits in production. The pure-updater
	// regression below is the canonical example of why.
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders nothing while the queue is idle', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const { container, render, unmount } = createStrictRoot();

		render(<CelebrationStage capture={undefined} />);

		expect(container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		unmount();
	});

	it('plays a captured asset and advances to the next on clip end', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const driver = makeClipEndDriver();
		const { container, render, unmount } = createStrictRoot();

		// Mount idle, then deliver captures as updates — the Session Tab never
		// mounts with a capture already present, and a StrictMode mount cleanup
		// would otherwise reclaim a URL stored during the mount-time effect.
		render(<CelebrationStage capture={undefined} onPlay={driver.onPlay} />);
		render(
			<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} onPlay={driver.onPlay} />,
		);

		expect(driver.onPlay).toHaveBeenLastCalledWith(expect.any(Function), 'a');

		// A distinct asset arrives while 'a' is playing -> it waits, 'a' keeps playing.
		render(
			<CelebrationStage capture={{ assetId: 'b', assetUrl: 'blob:b' }} onPlay={driver.onPlay} />,
		);
		expect(revoke).not.toHaveBeenCalled();

		// 'a' clip ends -> 'a' URL revoked, 'b' promoted and playing.
		act(() => {
			driver.endClip();
		});

		expect(revoke).toHaveBeenCalledWith('blob:a');
		expect(driver.onPlay).toHaveBeenLastCalledWith(expect.any(Function), 'b');

		// 'b' ends with nothing waiting -> revoke 'b', stage goes idle.
		act(() => {
			driver.endClip();
		});

		expect(revoke).toHaveBeenCalledWith('blob:b');
		expect(container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		unmount();
	});

	it('revokes the object URL of a dropped asset that never plays', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		// Mount idle, then feed captures as updates (see note above).
		render(<CelebrationStage capture={undefined} />);
		// 'a' plays, 'b' waits.
		render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} />);
		render(<CelebrationStage capture={{ assetId: 'b', assetUrl: 'blob:b' }} />);

		// 'c' exceeds the cap -> dropped -> its URL is revoked immediately.
		render(<CelebrationStage capture={{ assetId: 'c', assetUrl: 'blob:c' }} />);

		expect(revoke).toHaveBeenCalledWith('blob:c');
		expect(revoke).not.toHaveBeenCalledWith('blob:a');
		expect(revoke).not.toHaveBeenCalledWith('blob:b');

		unmount();
	});

	it('notifies onCaptureIngested once per distinct capture so a feeder can advance', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const onCaptureIngested = vi.fn();
		const { render, unmount } = createStrictRoot();

		// Mount idle, then feed captures as updates (see note above).
		render(<CelebrationStage capture={undefined} onCaptureIngested={onCaptureIngested} />);
		render(
			<CelebrationStage
				capture={{ assetId: 'a', assetUrl: 'blob:a' }}
				onCaptureIngested={onCaptureIngested}
			/>,
		);
		expect(onCaptureIngested).toHaveBeenCalledTimes(1);

		// A new distinct capture is ingested -> one more notification.
		const captureB = { assetId: 'b', assetUrl: 'blob:b' };
		render(<CelebrationStage capture={captureB} onCaptureIngested={onCaptureIngested} />);
		expect(onCaptureIngested).toHaveBeenCalledTimes(2);

		// Re-rendering with the same capture reference ingests nothing.
		render(<CelebrationStage capture={captureB} onCaptureIngested={onCaptureIngested} />);
		expect(onCaptureIngested).toHaveBeenCalledTimes(2);

		unmount();
	});

	it('does not revoke the playing URL under StrictMode (pure updater)', () => {
		// Regression: the stage performed URL.revokeObjectURL / map mutations inside
		// the setQueue updater. React double-invokes updaters under StrictMode, so the
		// second pass saw the URL already stored and revoked it — the <video> then
		// loaded a dead blob (net::ERR_FILE_NOT_FOUND) and nothing played.
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const driver = makeClipEndDriver();
		const { render, unmount } = createStrictRoot();

		// Mount idle (as the real Session Tab does), then deliver the capture as an
		// update — that update's setQueue is the one StrictMode double-invokes.
		render(<CelebrationStage capture={undefined} onPlay={driver.onPlay} />);
		render(
			<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} onPlay={driver.onPlay} />,
		);

		expect(driver.onPlay).toHaveBeenLastCalledWith(expect.any(Function), 'a');
		// The URL that is actually playing must survive StrictMode's double-invoke.
		expect(revoke).not.toHaveBeenCalledWith('blob:a');

		unmount();
	});

	it('revokes a coalesced duplicate object URL without interrupting playback', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		// Mount idle, then feed captures as updates (see note above).
		render(<CelebrationStage capture={undefined} />);
		render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} />);
		// Same gift captured again -> byte-identical asset, distinct object URL.
		render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a2' }} />);

		// The duplicate URL is revoked; the original keeps playing.
		expect(revoke).toHaveBeenCalledWith('blob:a2');
		expect(revoke).not.toHaveBeenCalledWith('blob:a');

		unmount();
	});
});
