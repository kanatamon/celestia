import { describe, expect, it } from 'vitest';
import {
	admitHearts,
	createHeart,
	DIVERT_DUR,
	type Heart,
	heartsForBatch,
	MAX_HEARTS,
	RISE_DUR,
	stepHeart,
} from '../src/like-layer-motion.js';

function advance(heart: Heart, dt: number, steps: number): { heart: Heart; arrivals: number } {
	let current = heart;
	let arrivals = 0;
	for (let i = 0; i < steps; i += 1) {
		const result = stepHeart(current, dt);
		current = result.heart;
		if (result.arrivedNow) arrivals += 1;
	}
	return { heart: current, arrivals };
}

describe('stepHeart lifecycle', () => {
	it('starts a fresh heart in the rise phase', () => {
		expect(createHeart('h1').phase).toBe('rise');
	});

	it('stays in rise until the rise duration elapses, then transitions to divert', () => {
		const rising = stepHeart(createHeart('h1'), RISE_DUR / 2);
		expect(rising.heart.phase).toBe('rise');
		expect(rising.heart.riseT).toBeCloseTo(RISE_DUR / 2);

		const diverting = stepHeart(rising.heart, RISE_DUR / 2 + 0.01);
		expect(diverting.heart.phase).toBe('divert');
	});

	it('progresses rise -> divert -> fade -> dead across the thresholds', () => {
		// One big dt blows past the rise into divert.
		const afterRise = stepHeart(createHeart('h1'), RISE_DUR + 0.001);
		expect(afterRise.heart.phase).toBe('divert');

		// Finish the divert -> fade.
		const afterDivert = stepHeart(afterRise.heart, DIVERT_DUR);
		expect(afterDivert.heart.phase).toBe('fade');

		// Fade -> dead on the next step.
		const dead = stepHeart(afterDivert.heart, 0.016);
		expect(dead.heart.phase).toBe('dead');
	});

	it('fires the arrival signal exactly once per heart', () => {
		const { heart, arrivals } = advance(createHeart('h1'), 0.05, 200);
		expect(heart.phase).toBe('dead');
		expect(arrivals).toBe(1);
	});

	it('never re-fires arrival once a heart has arrived', () => {
		// Reach the counter in a single big step.
		const arrived = stepHeart(createHeart('h1'), RISE_DUR + DIVERT_DUR + 1);
		expect(arrived.arrivedNow).toBe(true);
		expect(arrived.heart.arrived).toBe(true);

		const again = stepHeart(arrived.heart, 1);
		expect(again.arrivedNow).toBe(false);
	});

	it('treats a dead heart as inert', () => {
		const dead: Heart = { ...createHeart('h1'), phase: 'dead' };
		const result = stepHeart(dead, 1);
		expect(result.heart).toBe(dead);
		expect(result.arrivedNow).toBe(false);
	});

	it('is a no-op for non-positive dt', () => {
		const heart = createHeart('h1');
		expect(stepHeart(heart, 0).heart).toBe(heart);
		expect(stepHeart(heart, -1).heart).toBe(heart);
	});

	it('does not mutate the input heart', () => {
		const heart = createHeart('h1');
		stepHeart(heart, 0.5);
		expect(heart).toEqual(createHeart('h1'));
	});
});

describe('admitHearts (MAX_HEARTS cap)', () => {
	it('keeps every heart while under the ceiling', () => {
		const hearts = [createHeart('a'), createHeart('b')];
		const result = admitHearts(hearts, [createHeart('c')]);
		expect(result.map((h) => h.id)).toEqual(['a', 'b', 'c']);
	});

	it('drops the oldest hearts when the ceiling is exceeded', () => {
		const existing = Array.from({ length: MAX_HEARTS }, (_, i) => createHeart(`old-${i}`));
		const result = admitHearts(existing, [createHeart('new')]);
		expect(result).toHaveLength(MAX_HEARTS);
		expect(result.at(-1)?.id).toBe('new');
		// The very oldest was evicted; the newest is always retained.
		expect(result.find((h) => h.id === 'old-0')).toBeUndefined();
	});
});

describe('heartsForBatch', () => {
	it('returns one heart for a single like', () => {
		expect(heartsForBatch(1)).toBe(1);
	});

	it('never returns fewer than one heart for zero or negative deltas', () => {
		expect(heartsForBatch(0)).toBe(1);
		expect(heartsForBatch(-5)).toBe(1);
		expect(heartsForBatch(Number.NaN)).toBe(1);
	});

	it('grows logarithmically for small batches', () => {
		// 1 + log(5) ≈ 2.6 -> 3
		expect(heartsForBatch(5)).toBe(Math.round(1 + Math.log(5)));
	});

	it('stays modest for large batches (no flooding)', () => {
		// 1 + log(1000) ≈ 7.9 -> 8: bigger, but nowhere near MAX_HEARTS.
		expect(heartsForBatch(1000)).toBe(Math.round(1 + Math.log(1000)));
		expect(heartsForBatch(1000)).toBeLessThan(MAX_HEARTS);
	});

	it('is monotonic in the delta', () => {
		expect(heartsForBatch(2)).toBeLessThanOrEqual(heartsForBatch(20));
		expect(heartsForBatch(20)).toBeLessThanOrEqual(heartsForBatch(200));
	});
});
