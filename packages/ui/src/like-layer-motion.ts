/**
 * Like Layer motion (PRD #79, issue #80).
 *
 * Two pure, clock-injected primitives that own every decision-bearing piece of
 * the **Heart Float**:
 *
 * - `stepHeart(heart, dt)` — the per-heart lifecycle state machine
 *   (`rise → divert → fade → dead`), advanced by an injected `dt` (seconds).
 *   It also reports whether *this* step is the one where the heart reaches the
 *   Like Counter, so the **Like Counter pop** can fire exactly once per heart.
 * - `heartsForBatch(n)` — maps one `LikeLiveEvent`'s like delta `n` to a heart
 *   count `1 + log(n)`, never below 1.
 *
 * Both are platform-agnostic and side-effect-free. The canvas renderer in
 * `like-layer` is a dumb projection of the state these produce; geometry
 * (spawn/target pixel coordinates) is applied by the renderer, not modelled
 * here — this module owns *time*, the renderer owns *space*.
 *
 * Tunables are locked from the throwaway prototype
 * `prototypes/like-sender-row-prototype.html?variant=3` (reference only).
 */

/** Upward rise speed in canvas px/sec while a heart balloons (prototype lock). */
export const RISE_SPEED = 165;
/** Horizontal sway amplitude in px during the rise (prototype lock). */
export const SWAY_AMP = 14;
/** Sway frequency in Hz (prototype lock). */
export const SWAY_FREQ = 1.1;
/** Duration in seconds of the peel-off toward the Like Counter (prototype lock). */
export const DIVERT_DUR = 0.95;
/** How long a heart rises before it peels off toward the counter, in seconds. */
export const RISE_DUR = 1.1;
/** Hard ceiling on simultaneously-in-flight hearts; oldest dropped past it. */
export const MAX_HEARTS = 70;

/** Lifecycle phase of a single Heart Float. */
export type HeartPhase = 'rise' | 'divert' | 'fade' | 'dead';

/**
 * A single Heart Float. Time-domain state only; the renderer maps `(phase,
 * riseT, divertT)` onto pixel coordinates between the spawn and target anchors.
 */
export interface Heart {
	/** Stable id; the renderer keys sprites by it and the cap drops by age. */
	readonly id: string;
	phase: HeartPhase;
	/** Seconds elapsed in the `rise` phase. */
	riseT: number;
	/** Seconds elapsed in the `divert` phase (0 until peel-off begins). */
	divertT: number;
	/**
	 * Whether the arrival signal has already fired for this heart. Latches true
	 * the first step the heart reaches the counter, so the Like Counter pop fires
	 * exactly once per heart even across many subsequent steps.
	 */
	arrived: boolean;
}

export interface StepHeartResult {
	heart: Heart;
	/**
	 * True only on the single step where the heart completes its peel-off and
	 * reaches the Like Counter. Fires exactly once per heart.
	 */
	arrivedNow: boolean;
}

/** Mint a fresh Heart Float at the start of its `rise` phase. */
export function createHeart(id: string): Heart {
	return { id, phase: 'rise', riseT: 0, divertT: 0, arrived: false };
}

/**
 * Advance one Heart Float by `dt` seconds. Pure: returns a new heart, never
 * mutates the input. A dead heart is inert (the renderer drops it). The arrival
 * signal latches on the heart so it can never fire twice.
 */
export function stepHeart(heart: Heart, dt: number): StepHeartResult {
	if (heart.phase === 'dead' || dt <= 0) {
		return { heart, arrivedNow: false };
	}

	switch (heart.phase) {
		case 'rise': {
			const riseT = heart.riseT + dt;
			if (riseT < RISE_DUR) {
				return { heart: { ...heart, riseT }, arrivedNow: false };
			}
			// Cross into divert; carry the overshoot so motion stays continuous.
			return stepHeart(
				{ ...heart, phase: 'divert', riseT: RISE_DUR, divertT: 0 },
				riseT - RISE_DUR,
			);
		}
		case 'divert': {
			const divertT = heart.divertT + dt;
			if (divertT < DIVERT_DUR) {
				return { heart: { ...heart, divertT }, arrivedNow: false };
			}
			// Reached the counter. Fire the arrival signal exactly once, then fade.
			const arrivedNow = !heart.arrived;
			return {
				heart: { ...heart, phase: 'fade', divertT: DIVERT_DUR, arrived: true },
				arrivedNow,
			};
		}
		case 'fade':
			// The fade is instantaneous in the time domain: the heart has arrived
			// and the renderer fades the sprite out, then drops it. Marked dead so
			// the loop can go idle once no hearts remain.
			return { heart: { ...heart, phase: 'dead' }, arrivedNow: false };
		default:
			return { heart, arrivedNow: false };
	}
}

/**
 * Hearts to spawn for a `LikeLiveEvent` carrying a like delta `n`:
 * `1 + log(n)`, floored at 1 and rounded to a whole heart. A single like makes
 * one heart; a big batch makes a slightly fuller burst without flooding.
 */
export function heartsForBatch(n: number): number {
	if (!Number.isFinite(n) || n <= 1) {
		return 1;
	}
	return Math.max(1, Math.round(1 + Math.log(n)));
}

/**
 * Append freshly-spawned hearts, enforcing the `MAX_HEARTS` ceiling by dropping
 * the oldest (front of the list) so the newest spawns always survive. Pure.
 */
export function admitHearts(hearts: readonly Heart[], spawned: readonly Heart[]): Heart[] {
	const combined = [...hearts, ...spawned];
	if (combined.length <= MAX_HEARTS) {
		return combined;
	}
	return combined.slice(combined.length - MAX_HEARTS);
}
