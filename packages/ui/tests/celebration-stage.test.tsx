import { act } from 'react';
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
