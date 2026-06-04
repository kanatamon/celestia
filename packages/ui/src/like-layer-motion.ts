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
/**
 * Fallback rise duration in seconds. The renderer normally injects a per-heart
 * `riseDur` derived from geometry (rise to near the top of the feed, then peel
 * off), so a heart climbs the *whole* feed rather than a fixed stub; this
 * constant is the default when no geometry is supplied (and the test baseline).
 */
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
	/**
	 * Per-heart launch fields so a *burst* flies as independent particles instead
	 * of one stacked clump (the renderer applies them in space; this module just
	 * carries them through time):
	 */
	/** Seconds this heart sits idle before its rise begins — staggers a burst. */
	delay: number;
	/** How long *this* heart rises before peeling off (renderer-derived geometry). */
	readonly riseDur: number;
	/** Sway phase offset so neighbours don't sway in lockstep. */
	readonly swayPhase: number;
	/** Per-heart sway amplitude in px (slight variance around `SWAY_AMP`). */
	readonly swayAmp: number;
	/** Horizontal spawn offset in px so hearts fan out from the launch edge. */
	readonly spawnDX: number;
}

/** Optional per-heart launch parameters; every field defaults to the prototype lock. */
export interface HeartInit {
	delay?: number;
	riseDur?: number;
	swayPhase?: number;
	swayAmp?: number;
	spawnDX?: number;
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
export function createHeart(id: string, init: HeartInit = {}): Heart {
	return {
		id,
		phase: 'rise',
		riseT: 0,
		divertT: 0,
		arrived: false,
		delay: init.delay ?? 0,
		riseDur: init.riseDur ?? RISE_DUR,
		swayPhase: init.swayPhase ?? 0,
		swayAmp: init.swayAmp ?? SWAY_AMP,
		spawnDX: init.spawnDX ?? 0,
	};
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
			// Burn the stagger delay first so a burst launches as a stream, not a
			// clump. If the delay outlasts this step the heart stays parked; any
			// leftover after the delay ends folds straight into the rise.
			let step = dt;
			if (heart.delay > 0) {
				if (heart.delay >= step) {
					return { heart: { ...heart, delay: heart.delay - step }, arrivedNow: false };
				}
				step -= heart.delay;
			}
			const riseT = heart.riseT + step;
			if (riseT < heart.riseDur) {
				return { heart: { ...heart, delay: 0, riseT }, arrivedNow: false };
			}
			// Cross into divert; carry the overshoot so motion stays continuous.
			return stepHeart(
				{ ...heart, delay: 0, phase: 'divert', riseT: heart.riseDur, divertT: 0 },
				riseT - heart.riseDur,
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

/** Conditions under which a spawn is dropped (never buffered). */
export interface SpawnConditions {
	/**
	 * Reduced Like Motion is on (the User Preference, the sole source of truth —
	 * OS `prefers-reduced-motion` is never consulted): drop the Heart Float entirely.
	 */
	readonly reducedMotion: boolean;
	/** The Session Tab is hidden: drop-not-buffer so returning unleashes no flood. */
	readonly hidden: boolean;
}

/**
 * Whether a like with delta `n` should spawn Heart Floats, and how many.
 *
 * The **count always races elsewhere** (the live-event store folds the like into
 * `likeCount` independently), so suppressing the decorative Heart Float never
 * loses information. Spawns are **dropped, never buffered**, under Reduced Like
 * Motion or while the tab is hidden — returning then unleashes no backlog. This
 * is the pure twin of the canvas spawn sink, so the suppression is unit-testable.
 */
export function spawnHeartCount(n: number, conditions: SpawnConditions): number {
	if (conditions.reducedMotion || conditions.hidden) {
		return 0;
	}
	return heartsForBatch(n);
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
