import { describe, expect, it } from 'vitest';
import {
	CELEBRATION_DIAMOND_THRESHOLD,
	GRACE_WINDOW_MS,
	initialSynthesizedTriggerState,
	reduceSynthesizedTrigger,
	type SynthesizedTriggerEvent,
	type SynthesizedTriggerState,
} from '../src/session-tab/synthesized-celebration-trigger.js';

/**
 * Drives a sequence of events through the arbiter, collecting every emitted
 * synthesized capture in order. Returns the final state and the flat emission
 * list, so a test can assert deterministic mixed-burst behaviour by event order.
 */
function run(
	events: SynthesizedTriggerEvent[],
	options?: { threshold?: number; start?: SynthesizedTriggerState },
): { state: SynthesizedTriggerState; emitted: { iconUrl: string }[] } {
	const threshold = options?.threshold ?? CELEBRATION_DIAMOND_THRESHOLD;
	let state = options?.start ?? initialSynthesizedTriggerState;
	const emitted: { iconUrl: string }[] = [];
	for (const event of events) {
		const result = reduceSynthesizedTrigger(state, event, threshold);
		state = result.state;
		emitted.push(...result.emitted);
	}
	return { state, emitted };
}

describe('reduceSynthesizedTrigger', () => {
	it('starts idle with no pending windows', () => {
		expect(initialSynthesizedTriggerState).toEqual({ pending: [] });
	});

	it('defaults the threshold to 99', () => {
		expect(CELEBRATION_DIAMOND_THRESHOLD).toBe(99);
	});

	it('emits a synthesized capture when an armed gift gets no asset before the window expires', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 99, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([{ iconUrl: 'icon-a' }]);
	});

	it('does not emit before the grace window has elapsed', () => {
		const { emitted, state } = run([
			{ kind: 'giftEvent', diamondCount: 200, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS - 1 },
		]);

		expect(emitted).toEqual([]);
		expect(state.pending).toHaveLength(1);
	});

	it('cancels the oldest pending window when an asset is captured (animated owns it)', () => {
		const { emitted, state } = run([
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'assetCaptured', ts: 100 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([]);
		expect(state.pending).toEqual([]);
	});

	it('cancels only the oldest window per asset capture', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-b', ts: 10 },
			{ kind: 'assetCaptured', ts: 20 },
			{ kind: 'tick', now: 10 + GRACE_WINDOW_MS + 1 },
		]);

		// Oldest (icon-a) is claimed by the asset; icon-b still synthesizes.
		expect(emitted).toEqual([{ iconUrl: 'icon-b' }]);
	});

	it('never arms a gift below the threshold', () => {
		const { emitted, state } = run([
			{ kind: 'giftEvent', diamondCount: 98, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([]);
		expect(state.pending).toEqual([]);
	});

	it('arms a gift exactly at the threshold', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 99, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([{ iconUrl: 'icon-a' }]);
	});

	it('never arms a gift with a missing diamond count', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: undefined, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([]);
	});

	it('never arms a gift with a zero diamond count', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 0, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([]);
	});

	it('never arms a gift with no icon url', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 500, iconUrl: undefined, ts: 0 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([]);
	});

	it('uses unit diamond value: a streak of a sub-threshold gift never synthesizes', () => {
		const events: SynthesizedTriggerEvent[] = [];
		// 50 repeats of a 5-diamond gift: streak total 250 >= 99, but unit 5 < 99.
		for (let i = 0; i < 50; i += 1) {
			events.push({ kind: 'giftEvent', diamondCount: 5, iconUrl: 'cheap', ts: i });
		}
		events.push({ kind: 'tick', now: GRACE_WINDOW_MS + 100 });

		expect(run(events).emitted).toEqual([]);
	});

	it('coalesces identical consecutive icons into a single window', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 5 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 10 },
			{ kind: 'tick', now: GRACE_WINDOW_MS + 100 },
		]);

		expect(emitted).toEqual([{ iconUrl: 'icon-a' }]);
	});

	it('does not coalesce a repeated icon that is not consecutive', () => {
		const { emitted } = run([
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-b', ts: 5 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 10 },
			{ kind: 'tick', now: 10 + GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([{ iconUrl: 'icon-a' }, { iconUrl: 'icon-b' }, { iconUrl: 'icon-a' }]);
	});

	it('emits multiple expired windows in arrival order on a single tick', () => {
		const { emitted, state } = run([
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-b', ts: 5 },
			{ kind: 'tick', now: 5 + GRACE_WINDOW_MS + 1 },
		]);

		expect(emitted).toEqual([{ iconUrl: 'icon-a' }, { iconUrl: 'icon-b' }]);
		expect(state.pending).toEqual([]);
	});

	it('respects a custom threshold', () => {
		const { emitted } = run(
			[
				{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-a', ts: 0 },
				{ kind: 'tick', now: GRACE_WINDOW_MS + 1 },
			],
			{ threshold: 500 },
		);

		expect(emitted).toEqual([]);
	});

	it('does not mutate the input state', () => {
		const state: SynthesizedTriggerState = {
			pending: [{ iconUrl: 'icon-a', deadline: GRACE_WINDOW_MS }],
		};
		const frozen = Object.freeze({
			pending: Object.freeze([...state.pending]),
		}) as SynthesizedTriggerState;

		reduceSynthesizedTrigger(
			frozen,
			{ kind: 'giftEvent', diamondCount: 100, iconUrl: 'icon-b', ts: 1 },
			CELEBRATION_DIAMOND_THRESHOLD,
		);

		expect(state.pending).toHaveLength(1);
	});
});
