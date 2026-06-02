import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CelebrationStage } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders nothing while the queue is idle', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<CelebrationStage capture={undefined} />);
		});

		expect(container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		act(() => {
			root.unmount();
		});
	});

	it('plays a captured asset and advances to the next on clip end', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const driver = makeClipEndDriver();
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(
				<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} onPlay={driver.onPlay} />,
			);
		});

		expect(driver.onPlay).toHaveBeenLastCalledWith(expect.any(Function), 'a');

		// A distinct asset arrives while 'a' is playing -> it waits, 'a' keeps playing.
		act(() => {
			root.render(
				<CelebrationStage capture={{ assetId: 'b', assetUrl: 'blob:b' }} onPlay={driver.onPlay} />,
			);
		});
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

		act(() => {
			root.unmount();
		});
	});

	it('revokes the object URL of a dropped asset that never plays', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		// 'a' plays, 'b' waits.
		act(() => {
			root.render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} />);
		});
		act(() => {
			root.render(<CelebrationStage capture={{ assetId: 'b', assetUrl: 'blob:b' }} />);
		});

		// 'c' exceeds the cap -> dropped -> its URL is revoked immediately.
		act(() => {
			root.render(<CelebrationStage capture={{ assetId: 'c', assetUrl: 'blob:c' }} />);
		});

		expect(revoke).toHaveBeenCalledWith('blob:c');
		expect(revoke).not.toHaveBeenCalledWith('blob:a');
		expect(revoke).not.toHaveBeenCalledWith('blob:b');

		act(() => {
			root.unmount();
		});
	});

	it('notifies onCaptureIngested once per distinct capture so a feeder can advance', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const onCaptureIngested = vi.fn();
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(
				<CelebrationStage
					capture={{ assetId: 'a', assetUrl: 'blob:a' }}
					onCaptureIngested={onCaptureIngested}
				/>,
			);
		});
		expect(onCaptureIngested).toHaveBeenCalledTimes(1);

		// A new distinct capture is ingested -> one more notification.
		const captureB = { assetId: 'b', assetUrl: 'blob:b' };
		act(() => {
			root.render(<CelebrationStage capture={captureB} onCaptureIngested={onCaptureIngested} />);
		});
		expect(onCaptureIngested).toHaveBeenCalledTimes(2);

		// Re-rendering with the same capture reference ingests nothing.
		act(() => {
			root.render(<CelebrationStage capture={captureB} onCaptureIngested={onCaptureIngested} />);
		});
		expect(onCaptureIngested).toHaveBeenCalledTimes(2);

		act(() => {
			root.unmount();
		});
	});

	it('does not revoke the playing URL under StrictMode (pure updater)', () => {
		// Regression: the stage performed URL.revokeObjectURL / map mutations inside
		// the setQueue updater. React double-invokes updaters under StrictMode, so the
		// second pass saw the URL already stored and revoked it — the <video> then
		// loaded a dead blob (net::ERR_FILE_NOT_FOUND) and nothing played.
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const driver = makeClipEndDriver();
		const container = document.createElement('div');
		const root = createRoot(container);

		// Mount idle (as the real Session Tab does), then deliver the capture as an
		// update — that update's setQueue is the one StrictMode double-invokes.
		act(() => {
			root.render(
				<StrictMode>
					<CelebrationStage capture={undefined} onPlay={driver.onPlay} />
				</StrictMode>,
			);
		});
		act(() => {
			root.render(
				<StrictMode>
					<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} onPlay={driver.onPlay} />
				</StrictMode>,
			);
		});

		expect(driver.onPlay).toHaveBeenLastCalledWith(expect.any(Function), 'a');
		// The URL that is actually playing must survive StrictMode's double-invoke.
		expect(revoke).not.toHaveBeenCalledWith('blob:a');

		act(() => {
			root.unmount();
		});
	});

	it('revokes a coalesced duplicate object URL without interrupting playback', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a' }} />);
		});
		// Same gift captured again -> byte-identical asset, distinct object URL.
		act(() => {
			root.render(<CelebrationStage capture={{ assetId: 'a', assetUrl: 'blob:a2' }} />);
		});

		// The duplicate URL is revoked; the original keeps playing.
		expect(revoke).toHaveBeenCalledWith('blob:a2');
		expect(revoke).not.toHaveBeenCalledWith('blob:a');

		act(() => {
			root.unmount();
		});
	});
});
