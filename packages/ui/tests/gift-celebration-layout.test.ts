import { describe, expect, it } from 'vitest';
import { computeGiftCelebrationTriptychLayout } from '../src/gift-celebration-layout.js';

describe('computeGiftCelebrationTriptychLayout', () => {
	it('centers a portrait clip at full height on a wide desktop tab', () => {
		const layout = computeGiftCelebrationTriptychLayout({ width: 1440, height: 900 });

		expect(layout.center).toEqual({
			x: 466.875,
			y: 0,
			width: 506.25,
			height: 900,
			fit: 'contain',
			mirrored: false,
			blurPx: 0,
			brightness: 1,
			opacity: 1,
			zIndex: 2,
		});
	});

	it('places blurred mirrored gutter copies behind the center clip', () => {
		const layout = computeGiftCelebrationTriptychLayout({ width: 1200, height: 720 });

		expect(layout.leftGutter).toEqual({
			x: -72,
			y: 0,
			width: 504,
			height: 720,
			fit: 'cover',
			mirrored: true,
			blurPx: 10,
			brightness: 0.85,
			opacity: 0.6,
			zIndex: 1,
		});
		expect(layout.rightGutter).toEqual({
			x: 768,
			y: 0,
			width: 504,
			height: 720,
			fit: 'cover',
			mirrored: false,
			blurPx: 10,
			brightness: 0.85,
			opacity: 0.6,
			zIndex: 1,
		});
	});

	it('keeps the center clip contained on a narrow tab', () => {
		const layout = computeGiftCelebrationTriptychLayout({ width: 360, height: 900 });

		expect(layout.center).toMatchObject({
			x: 0,
			y: 130,
			width: 360,
			height: 640,
			fit: 'contain',
			zIndex: 2,
		});
	});
});
