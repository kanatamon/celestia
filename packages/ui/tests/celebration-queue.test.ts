import { describe, expect, it } from 'vitest';
import {
	type CelebrationEvent,
	type CelebrationQueueState,
	initialCelebrationQueueState,
	reduceCelebrationQueue,
} from '../src/celebration-queue.js';

interface ReducerCase {
	name: string;
	state: CelebrationQueueState;
	event: CelebrationEvent;
	expected: CelebrationQueueState;
}

const cases: ReducerCase[] = [
	{
		name: 'starts the first captured asset immediately when idle',
		state: { playing: undefined, waiting: [] },
		event: { kind: 'assetCaptured', assetId: 'a' },
		expected: { playing: { assetId: 'a' }, waiting: [] },
	},
	{
		name: 'enqueues a fresh asset behind the playing one',
		state: { playing: { assetId: 'a' }, waiting: [] },
		event: { kind: 'assetCaptured', assetId: 'b' },
		expected: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
	},
	{
		name: 'coalesces an asset identical to the playing one',
		state: { playing: { assetId: 'a' }, waiting: [] },
		event: { kind: 'assetCaptured', assetId: 'a' },
		expected: { playing: { assetId: 'a' }, waiting: [] },
	},
	{
		name: 'coalesces an asset identical to the last enqueued one',
		state: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
		event: { kind: 'assetCaptured', assetId: 'b' },
		expected: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
	},
	{
		name: 'drops a fresh asset when the waiting queue is at the cap',
		state: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
		event: { kind: 'assetCaptured', assetId: 'c' },
		expected: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
	},
	{
		name: 'promotes the next waiting asset on clip end',
		state: { playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] },
		event: { kind: 'clipEnded' },
		expected: { playing: { assetId: 'b' }, waiting: [] },
	},
	{
		name: 'goes idle on clip end when nothing is waiting',
		state: { playing: { assetId: 'a' }, waiting: [] },
		event: { kind: 'clipEnded' },
		expected: { playing: undefined, waiting: [] },
	},
	{
		name: 'ignores a clip end while already idle',
		state: { playing: undefined, waiting: [] },
		event: { kind: 'clipEnded' },
		expected: { playing: undefined, waiting: [] },
	},
];

describe('reduceCelebrationQueue', () => {
	for (const testCase of cases) {
		it(testCase.name, () => {
			expect(reduceCelebrationQueue(testCase.state, testCase.event)).toEqual(testCase.expected);
		});
	}

	it('starts idle with an empty queue', () => {
		expect(initialCelebrationQueueState).toEqual({ playing: undefined, waiting: [] });
	});

	it('does not mutate the input state', () => {
		const state: CelebrationQueueState = { playing: { assetId: 'a' }, waiting: [] };
		const frozen = Object.freeze({ ...state, waiting: Object.freeze([...state.waiting]) });

		reduceCelebrationQueue(frozen as CelebrationQueueState, {
			kind: 'assetCaptured',
			assetId: 'b',
		});

		expect(state).toEqual({ playing: { assetId: 'a' }, waiting: [] });
	});

	it('collapses a long run of the same asset to a single play', () => {
		let state = initialCelebrationQueueState;
		for (let index = 0; index < 5; index += 1) {
			state = reduceCelebrationQueue(state, { kind: 'assetCaptured', assetId: 'a' });
		}

		expect(state).toEqual({ playing: { assetId: 'a' }, waiting: [] });
	});

	it('keeps the freshest reachable asset and drops the overflow under a burst', () => {
		let state = initialCelebrationQueueState;
		for (const assetId of ['a', 'b', 'c', 'd']) {
			state = reduceCelebrationQueue(state, { kind: 'assetCaptured', assetId });
		}

		// 'a' plays, 'b' waits; 'c' and 'd' are dropped (freshness over completeness).
		expect(state).toEqual({ playing: { assetId: 'a' }, waiting: [{ assetId: 'b' }] });
	});
});
