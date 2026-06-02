import { afterEach, describe, expect, it, vi } from 'vitest';
import { GiftCelebration } from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

describe('GiftCelebration', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders nothing when no Gift Animation Asset is provided', () => {
		const { container, render, unmount } = createStrictRoot();

		render(<GiftCelebration />);

		expect(container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		unmount();
	});

	it('renders a full-bleed triptych stage for a provided Gift Animation Asset', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const { container, render, unmount } = createStrictRoot();

		render(<GiftCelebration assetUrl="blob:gift-animation" />);

		const stage = container.querySelector('[aria-label="Gift Celebration"]');
		expect(stage).toBeInstanceOf(HTMLElement);
		expect(stage?.querySelectorAll('canvas')).toHaveLength(3);
		expect(stage?.textContent).toBe('');

		unmount();
	});

	it('measures the triptych stage when a Gift Animation Asset appears after idle', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 0, 1200, 720),
		);
		const { container, render, unmount } = createStrictRoot();

		render(<GiftCelebration />);
		render(<GiftCelebration assetUrl="blob:gift-animation" />);

		const centerCanvas = container.querySelector('[aria-label="Gift Celebration center"]');
		expect(centerCanvas).toBeInstanceOf(HTMLCanvasElement);
		if (!(centerCanvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected center Gift Celebration canvas to render');
		}
		expect(centerCanvas.style.width).toBe('405px');
		expect(centerCanvas.style.height).toBe('720px');

		unmount();
	});
});
