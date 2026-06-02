import { act } from 'react';
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

	describe('synthesized path', () => {
		it('renders the icon triptych with no <video> and no WebGL', () => {
			// Stage has zero measured size here, so the fx canvas idle-skips mounting;
			// the icon triptych itself is the only thing rendered.
			const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
			const { container, render, unmount } = createStrictRoot();

			render(<GiftCelebration giftImageUrl="https://cdn/icon.png" />);

			const stage = container.querySelector('[aria-label="Gift Celebration"]');
			expect(stage).toBeInstanceOf(HTMLElement);
			// Centre icon + two gutters, all <img> sourcing the Gift Icon.
			const images = stage?.querySelectorAll('img');
			expect(images).toHaveLength(3);
			for (const image of images ?? []) {
				expect(image.getAttribute('src')).toBe('https://cdn/icon.png');
			}
			// The synthesized path never mounts a <video> and never asks for WebGL —
			// the icon is already RGBA, so there is no split-alpha shader.
			expect(stage?.querySelectorAll('video')).toHaveLength(0);
			expect(getContext).not.toHaveBeenCalledWith('webgl');

			unmount();
		});

		it('mounts a 1× additive fireworks fx canvas (2d, never WebGL) when measured', () => {
			vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
				new DOMRect(0, 0, 1200, 720),
			);
			const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
			const { container, render, unmount } = createStrictRoot();

			render(<GiftCelebration giftImageUrl="https://cdn/icon.png" />);

			const stage = container.querySelector('[aria-label="Gift Celebration"]');
			// Exactly one canvas — the fx overlay — and it is a 2d context, no WebGL,
			// and no <video>.
			expect(stage?.querySelectorAll('canvas')).toHaveLength(1);
			expect(stage?.querySelectorAll('video')).toHaveLength(0);
			expect(getContext).toHaveBeenCalledWith('2d');
			expect(getContext).not.toHaveBeenCalledWith('webgl');

			unmount();
		});

		it('mirrors the left gutter and blurs/dims both gutters per the layout', () => {
			vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
				new DOMRect(0, 0, 1200, 720),
			);
			const { container, render, unmount } = createStrictRoot();

			render(<GiftCelebration giftImageUrl="https://cdn/icon.png" />);

			const left = container.querySelector('[aria-label="Gift Celebration left gutter"]');
			const right = container.querySelector('[aria-label="Gift Celebration right gutter"]');
			const center = container.querySelector('[aria-label="Gift Celebration center"]');
			if (
				!(left instanceof HTMLImageElement) ||
				!(right instanceof HTMLImageElement) ||
				!(center instanceof HTMLImageElement)
			) {
				throw new Error('Expected three Gift Celebration icon panes');
			}

			// Left gutter mirrored; right gutter and centre are not.
			expect(left.style.transform).toBe('scaleX(-1)');
			expect(right.style.transform).toBe('');
			expect(center.style.transform).toBe('');

			// Gutters are blurred and dimmed; the centre is crisp and bright.
			const leftPane = left.parentElement as HTMLElement;
			const centerPane = center.parentElement as HTMLElement;
			expect(leftPane.style.filter).toContain('blur(10px)');
			expect(leftPane.style.opacity).toBe('0.6');
			expect(centerPane.style.filter).toBe('blur(0px) brightness(1)');

			unmount();
		});

		it('fires onEnded after exactly one ~2.8s cycle', () => {
			vi.useFakeTimers();
			const onEnded = vi.fn();
			const { render, unmount } = createStrictRoot();

			render(<GiftCelebration giftImageUrl="https://cdn/icon.png" onEnded={onEnded} />);

			expect(onEnded).not.toHaveBeenCalled();
			act(() => {
				vi.advanceTimersByTime(2800);
			});
			expect(onEnded).toHaveBeenCalledTimes(1);

			unmount();
			vi.useRealTimers();
		});
	});
});
