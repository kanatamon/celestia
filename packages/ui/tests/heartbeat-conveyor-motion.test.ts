import { describe, expect, it } from 'vitest';
import {
	BEAT_MS,
	CONVEYOR_CAPACITY,
	type ConveyorLiker,
	type ConveyorState,
	computeConveyor,
	initialConveyorState,
} from '../src/heartbeat-conveyor-motion.js';

function liker(id: string, extra: Partial<ConveyorLiker> = {}): ConveyorLiker {
	return { id, avatarUrl: `https://cdn/${id}.jpg`, name: id, ...extra };
}

function like(state: ConveyorState, l: ConveyorLiker, now: number): ConveyorState {
	return computeConveyor(state, { kind: 'like', liker: l }, now);
}

function beat(state: ConveyorState, now: number): ConveyorState {
	return computeConveyor(state, { kind: 'beat' }, now);
}

function beatReduced(state: ConveyorState, now: number): ConveyorState {
	return computeConveyor(state, { kind: 'beat', reducedMotion: true }, now);
}

describe('computeConveyor — beat commit decoupling', () => {
	it('does not advance the row on a like event, only on a beat', () => {
		let state = initialConveyorState;
		state = like(state, liker('a'), 0);
		// A like alone never seats anyone — the row only moves on the beat.
		expect(state.slots).toHaveLength(0);

		state = beat(state, BEAT_MS);
		expect(state.slots.map((s) => s.liker.id)).toEqual(['a']);
	});

	it('commits only the latest unique liker per beat under a storm', () => {
		let state = initialConveyorState;
		// A like storm: many likers between two beats.
		for (const id of ['a', 'b', 'c', 'd']) {
			state = like(state, liker(id), 10);
		}
		// One beat commits exactly one seat — the latest liker, not all four.
		state = beat(state, BEAT_MS);
		expect(state.slots.map((s) => s.liker.id)).toEqual(['d']);
	});

	it('commits nothing on a beat with no pending liker', () => {
		let state = initialConveyorState;
		state = beat(state, BEAT_MS);
		expect(state.slots).toHaveLength(0);
		// A pending liker is consumed by a beat and not re-committed on the next.
		state = like(state, liker('a'), 0);
		state = beat(state, BEAT_MS);
		state = beat(state, BEAT_MS * 2);
		expect(state.slots.map((s) => s.liker.id)).toEqual(['a']);
	});
});

describe('computeConveyor — dedupe + capacity', () => {
	it('appends new likers and keeps insertion order, newest on the right', () => {
		let state = initialConveyorState;
		state = beat(like(state, liker('a'), 0), BEAT_MS);
		state = beat(like(state, liker('b'), BEAT_MS), BEAT_MS * 2);
		state = beat(like(state, liker('c'), BEAT_MS * 2), BEAT_MS * 3);
		expect(state.slots.map((s) => s.liker.id)).toEqual(['a', 'b', 'c']);
	});

	it('caps at CONVEYOR_CAPACITY, evicting the oldest on the left', () => {
		let state = initialConveyorState;
		let now = 0;
		for (let i = 0; i < CONVEYOR_CAPACITY + 2; i += 1) {
			now += BEAT_MS;
			state = beat(like(state, liker(`u${i}`), now - 1), now);
		}
		expect(state.slots).toHaveLength(CONVEYOR_CAPACITY);
		// u0 and u1 fell off the left; the most-recent CONVEYOR_CAPACITY remain.
		expect(state.slots[0]?.liker.id).toBe('u2');
		expect(state.slots.at(-1)?.liker.id).toBe(`u${CONVEYOR_CAPACITY + 1}`);
	});
});

describe('computeConveyor — repeat liker breathe without reorder', () => {
	it('breathes a repeat liker in place: no reorder, no new seat', () => {
		let state = initialConveyorState;
		state = beat(like(state, liker('a'), 0), BEAT_MS);
		state = beat(like(state, liker('b'), BEAT_MS), BEAT_MS * 2);
		const breatheBefore = state.slots.find((s) => s.liker.id === 'a')?.breatheSeq ?? 0;

		// 'a' likes again — already seated, so a beat breathes it where it sits.
		state = beat(like(state, liker('a'), BEAT_MS * 2), BEAT_MS * 3);

		// Same membership and order: a still first, b still second, no third seat.
		expect(state.slots.map((s) => s.liker.id)).toEqual(['a', 'b']);
		const breatheAfter = state.slots.find((s) => s.liker.id === 'a')?.breatheSeq ?? 0;
		expect(breatheAfter).toBe(breatheBefore + 1);
		// b is untouched — only the repeat liker breathes.
		expect(state.slots.find((s) => s.liker.id === 'b')?.breatheSeq).toBe(0);
	});

	it('refreshes a repeat liker’s identity payload without moving the seat', () => {
		let state = initialConveyorState;
		state = beat(like(state, liker('a', { avatarUrl: 'old.jpg' }), 0), BEAT_MS);
		state = beat(like(state, liker('a', { avatarUrl: 'new.jpg' }), BEAT_MS), BEAT_MS * 2);
		expect(state.slots).toHaveLength(1);
		expect(state.slots[0]?.liker.avatarUrl).toBe('new.jpg');
	});

	it('gives each seat a stable key across beats so the renderer can track it', () => {
		let state = initialConveyorState;
		state = beat(like(state, liker('a'), 0), BEAT_MS);
		const keyAfterFirst = state.slots[0]?.key;
		state = beat(like(state, liker('b'), BEAT_MS), BEAT_MS * 2);
		state = beat(like(state, liker('a'), BEAT_MS * 2), BEAT_MS * 3);
		const keyAfterBreathe = state.slots.find((s) => s.liker.id === 'a')?.key;
		expect(keyAfterBreathe).toBe(keyAfterFirst);
	});
});

describe('computeConveyor — Reduced Like Motion cross-fade branch', () => {
	it('stamps a newly seated face slide at full motion', () => {
		let state = initialConveyorState;
		state = beat(like(state, liker('a'), 0), BEAT_MS);
		expect(state.slots[0]?.transition).toBe('slide');
	});

	it('stamps a newly seated face crossfade under Reduced Like Motion', () => {
		let state = initialConveyorState;
		state = beatReduced(like(state, liker('a'), 0), BEAT_MS);
		expect(state.slots[0]?.transition).toBe('crossfade');
	});

	it('keeps membership identical regardless of the motion mode', () => {
		// Same likers, same beats: only the stamped transition differs.
		const ids = ['a', 'b', 'c'];
		let full = initialConveyorState;
		let reduced = initialConveyorState;
		let now = 0;
		for (const id of ids) {
			now += BEAT_MS;
			full = beat(like(full, liker(id), now - 1), now);
			reduced = beatReduced(like(reduced, liker(id), now - 1), now);
		}
		expect(full.slots.map((s) => s.liker.id)).toEqual(reduced.slots.map((s) => s.liker.id));
		expect(reduced.slots.every((s) => s.transition === 'crossfade')).toBe(true);
		expect(full.slots.every((s) => s.transition === 'slide')).toBe(true);
	});

	it('decides per beat: a face seated under reduced motion carries crossfade even when later beats are full motion', () => {
		let state = initialConveyorState;
		// 'a' seats under reduced motion.
		state = beatReduced(like(state, liker('a'), 0), BEAT_MS);
		// 'b' seats under full motion on a later beat.
		state = beat(like(state, liker('b'), BEAT_MS), BEAT_MS * 2);
		expect(state.slots.find((s) => s.liker.id === 'a')?.transition).toBe('crossfade');
		expect(state.slots.find((s) => s.liker.id === 'b')?.transition).toBe('slide');
	});

	it('breathes a repeat liker in place without changing its stamped transition', () => {
		let state = initialConveyorState;
		// 'a' seats with a slide.
		state = beat(like(state, liker('a'), 0), BEAT_MS);
		// 'a' repeats on a reduced-motion beat: it breathes in place, no reseat, and
		// the original slide transition is preserved (the breathe owns its own pulse).
		state = beatReduced(like(state, liker('a'), BEAT_MS), BEAT_MS * 2);
		expect(state.slots).toHaveLength(1);
		expect(state.slots[0]?.breatheSeq).toBe(1);
		expect(state.slots[0]?.transition).toBe('slide');
	});
});

describe('initialConveyorState', () => {
	it('starts empty', () => {
		expect(initialConveyorState.slots).toEqual([]);
		expect(BEAT_MS).toBe(1200);
		expect(CONVEYOR_CAPACITY).toBe(5);
	});
});
