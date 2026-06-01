import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GiftCelebration } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('GiftCelebration', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders nothing when no Gift Animation Asset is provided', () => {
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<GiftCelebration />);
		});

		expect(container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		act(() => {
			root.unmount();
		});
	});

	it('renders a full-bleed triptych stage for a provided Gift Animation Asset', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<GiftCelebration assetUrl="blob:gift-animation" />);
		});

		const stage = container.querySelector('[aria-label="Gift Celebration"]');
		expect(stage).toBeInstanceOf(HTMLElement);
		expect(stage?.querySelectorAll('canvas')).toHaveLength(3);
		expect(stage?.textContent).toBe('');

		act(() => {
			root.unmount();
		});
	});

	it('measures the triptych stage when a Gift Animation Asset appears after idle', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 0, 1200, 720),
		);
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<GiftCelebration />);
		});
		act(() => {
			root.render(<GiftCelebration assetUrl="blob:gift-animation" />);
		});

		const centerCanvas = container.querySelector('[aria-label="Gift Celebration center"]');
		expect(centerCanvas).toBeInstanceOf(HTMLCanvasElement);
		if (!(centerCanvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected center Gift Celebration canvas to render');
		}
		expect(centerCanvas.style.width).toBe('405px');
		expect(centerCanvas.style.height).toBe('720px');

		act(() => {
			root.unmount();
		});
	});
});
