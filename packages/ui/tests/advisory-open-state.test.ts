import { describe, expect, it } from 'vitest';
import {
	type AdvisoryOpenEvent,
	type AdvisoryOpenState,
	initialAdvisoryOpenState,
	reduceAdvisoryOpenState,
} from '../src/advisory-open-state.js';

/** Run a sequence of events from the initial state and return the final state. */
function runEvents(events: AdvisoryOpenEvent[]): AdvisoryOpenState {
	return events.reduce(reduceAdvisoryOpenState, initialAdvisoryOpenState);
}

describe('reduceAdvisoryOpenState', () => {
	it('starts closed with no episode', () => {
		expect(initialAdvisoryOpenState).toEqual({
			open: false,
			episodeId: 0,
			dismissed: false,
			faulting: false,
		});
	});

	it('auto-opens the advisory when a fault is entered', () => {
		const state = runEvents([{ kind: 'faultEntered' }]);
		expect(state.open).toBe(true);
		expect(state.episodeId).toBe(1);
	});

	it('treats a repeated faultEntered within the same episode as a no-op', () => {
		const state = runEvents([{ kind: 'faultEntered' }, { kind: 'faultEntered' }]);
		expect(state.open).toBe(true);
		// Still the first episode — no new episode, no re-trigger.
		expect(state.episodeId).toBe(1);
	});

	it('closes and latches the episode when dismissed', () => {
		const state = runEvents([{ kind: 'faultEntered' }, { kind: 'dismissed' }]);
		expect(state.open).toBe(false);
		expect(state.dismissed).toBe(true);
		expect(state.episodeId).toBe(1);
	});

	it('does not re-nag: a faultEntered after dismissal within the same episode stays closed', () => {
		const state = runEvents([
			{ kind: 'faultEntered' },
			{ kind: 'dismissed' },
			{ kind: 'faultEntered' },
		]);
		expect(state.open).toBe(false);
		expect(state.episodeId).toBe(1);
	});

	it('opens a fresh episode when a recovery is followed by a new fault', () => {
		const state = runEvents([
			{ kind: 'faultEntered' },
			{ kind: 'dismissed' },
			{ kind: 'recovered' },
			{ kind: 'faultEntered' },
		]);
		expect(state.open).toBe(true);
		expect(state.episodeId).toBe(2);
		expect(state.dismissed).toBe(false);
	});

	it('auto-closes on recovery', () => {
		const state = runEvents([{ kind: 'faultEntered' }, { kind: 'recovered' }]);
		expect(state.open).toBe(false);
		expect(state.dismissed).toBe(false);
	});

	it('reopens on demand after dismissal within the same episode', () => {
		const state = runEvents([
			{ kind: 'faultEntered' },
			{ kind: 'dismissed' },
			{ kind: 'reopened' },
		]);
		expect(state.open).toBe(true);
		// Reopening does not start a new episode.
		expect(state.episodeId).toBe(1);
		// Latch persists so a subsequent faultEntered still won't re-nag.
		expect(state.dismissed).toBe(true);
	});

	it('ignores a reopen when there is no active fault episode', () => {
		const state = runEvents([{ kind: 'reopened' }]);
		expect(state.open).toBe(false);
		expect(state.episodeId).toBe(0);
	});

	it('ignores a reopen after recovery (episode is over)', () => {
		const state = runEvents([
			{ kind: 'faultEntered' },
			{ kind: 'recovered' },
			{ kind: 'reopened' },
		]);
		expect(state.open).toBe(false);
	});

	it('does not mutate the input state', () => {
		const state = Object.freeze({ ...initialAdvisoryOpenState });
		reduceAdvisoryOpenState(state, { kind: 'faultEntered' });
		expect(state).toEqual(initialAdvisoryOpenState);
	});

	it('does not open while a fault is suppressed by Auto-Reconnect', () => {
		const state = runEvents([{ kind: 'faultEntered', suppressed: true }]);
		expect(state.open).toBe(false);
		// No episode starts while suppressed.
		expect(state.episodeId).toBe(0);
		expect(state.faulting).toBe(false);
	});

	it('opens when suppression lifts on exhaustion (the edge re-fires un-suppressed)', () => {
		const state = runEvents([
			{ kind: 'faultEntered', suppressed: true },
			{ kind: 'faultEntered', suppressed: false },
		]);
		expect(state.open).toBe(true);
		expect(state.episodeId).toBe(1);
	});

	it('still honours the dismiss latch after a suppressed fault opens on exhaustion', () => {
		const state = runEvents([
			{ kind: 'faultEntered', suppressed: true },
			{ kind: 'faultEntered', suppressed: false },
			{ kind: 'dismissed' },
			{ kind: 'faultEntered', suppressed: false },
		]);
		expect(state.open).toBe(false);
		expect(state.dismissed).toBe(true);
		expect(state.episodeId).toBe(1);
	});

	it('still reopens on demand after a suppressed fault opens on exhaustion', () => {
		const state = runEvents([
			{ kind: 'faultEntered', suppressed: true },
			{ kind: 'faultEntered', suppressed: false },
			{ kind: 'dismissed' },
			{ kind: 'reopened' },
		]);
		expect(state.open).toBe(true);
		expect(state.episodeId).toBe(1);
		expect(state.dismissed).toBe(true);
	});

	it('survives a full episode cycle: open, reopen, dismiss-again, recover', () => {
		const state = runEvents([
			{ kind: 'faultEntered' },
			{ kind: 'dismissed' },
			{ kind: 'reopened' },
			{ kind: 'dismissed' },
			{ kind: 'recovered' },
		]);
		expect(state.open).toBe(false);
		expect(state.dismissed).toBe(false);
	});
});
