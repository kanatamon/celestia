import { describe, expect, it } from 'vitest';
import {
	AUTO_RECONNECT_MAX_ATTEMPTS,
	type AutoReconnectEvent,
	type AutoReconnectResult,
	type AutoReconnectState,
	initialAutoReconnectState,
	reduceAutoReconnect,
} from '../src/session-tab/auto-reconnect.js';

/**
 * Drives a sequence of events from a starting state, returning the final state
 * and the per-event verdicts in order — so a test can assert when an attempt was
 * initiated (the `shouldAttempt` edge) and how suppression tracks the budget.
 */
function run(
	events: AutoReconnectEvent[],
	start: AutoReconnectState = initialAutoReconnectState,
): { state: AutoReconnectState; results: AutoReconnectResult[] } {
	let state = start;
	const results: AutoReconnectResult[] = [];
	for (const event of events) {
		const result = reduceAutoReconnect(state, event);
		state = result.state;
		results.push(result);
	}
	return { state, results };
}

/** The verdicts that initiated an attempt, in order. */
function attempts(results: AutoReconnectResult[]): AutoReconnectResult[] {
	return results.filter((result) => result.verdict.shouldAttempt);
}

describe('reduceAutoReconnect', () => {
	it('starts idle with a full budget and no suppression', () => {
		expect(initialAutoReconnectState).toEqual({
			attemptsRemaining: AUTO_RECONNECT_MAX_ATTEMPTS,
			retrying: false,
			attemptPending: false,
			exhausted: false,
		});
	});

	it('initiates a silent attempt and suppresses the advisory on the first fault', () => {
		const { state, results } = run([{ kind: 'faultObserved' }]);
		expect(results[0]?.verdict.shouldAttempt).toBe(true);
		expect(results[0]?.verdict.suppressAdvisory).toBe(true);
		expect(state.attemptsRemaining).toBe(AUTO_RECONNECT_MAX_ATTEMPTS - 1);
		expect(state.exhausted).toBe(false);
	});

	it('spends exactly three attempts before exhausting (~20s ceiling)', () => {
		// Each attempt fails by timing out; the worst case is three attempts.
		const { state, results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
		]);
		expect(attempts(results)).toHaveLength(AUTO_RECONNECT_MAX_ATTEMPTS);
		expect(state.exhausted).toBe(true);
		expect(state.attemptsRemaining).toBe(0);
	});

	it('decrements the budget on each failed attempt', () => {
		const { results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
		]);
		const remaining = results.map((result) => result.verdict.attemptsRemaining);
		expect(remaining).toEqual([2, 1, 0]);
	});

	it('counts a per-attempt timeout as a failure that triggers the next attempt', () => {
		const { results } = run([{ kind: 'faultObserved' }, { kind: 'attemptTimeout' }]);
		expect(results[1]?.verdict.shouldAttempt).toBe(true);
		expect(results[1]?.verdict.suppressAdvisory).toBe(true);
	});

	it('counts a re-fault while an attempt is in flight as a failure', () => {
		// A remount that re-faults (interrupted/stale again) fails the attempt.
		const { state, results } = run([{ kind: 'faultObserved' }, { kind: 'faultObserved' }]);
		expect(attempts(results)).toHaveLength(2);
		expect(state.attemptsRemaining).toBe(AUTO_RECONNECT_MAX_ATTEMPTS - 2);
	});

	it('flips suppression off on exhaustion so the advisory opens', () => {
		const { state, results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
		]);
		expect(state.exhausted).toBe(true);
		expect(results.at(-1)?.verdict.suppressAdvisory).toBe(false);
		expect(results.at(-1)?.verdict.shouldAttempt).toBe(false);
	});

	it('resets the budget and stops suppression when an attempt reaches connected', () => {
		const { state, results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'connected' },
		]);
		expect(state).toEqual(initialAutoReconnectState);
		expect(results.at(-1)?.verdict.suppressAdvisory).toBe(false);
	});

	it('grants a fresh full budget to a later, unrelated fault after recovery', () => {
		const { results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'connected' },
			{ kind: 'faultObserved' },
		]);
		// The post-recovery fault initiates with the full budget again.
		expect(results.at(-1)?.verdict.shouldAttempt).toBe(true);
		expect(results.at(-1)?.verdict.attemptsRemaining).toBe(AUTO_RECONNECT_MAX_ATTEMPTS - 1);
	});

	it('abandons mid-retry when the fault changes to off-live/offline', () => {
		const { state, results } = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'abandoned' },
		]);
		expect(state).toEqual(initialAutoReconnectState);
		expect(results.at(-1)?.verdict.shouldAttempt).toBe(false);
		expect(results.at(-1)?.verdict.suppressAdvisory).toBe(false);
	});

	it('does not restart the auto cycle when a manual one-shot re-faults after exhaustion', () => {
		const exhausted = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
		]).state;
		// The user clicks the patient manual Reconnect; it re-faults.
		const { state, results } = run([{ kind: 'faultObserved' }], exhausted);
		expect(results[0]?.verdict.shouldAttempt).toBe(false);
		expect(state.exhausted).toBe(true);
		expect(state.retrying).toBe(false);
	});

	it('lets a successful manual one-shot after exhaustion reset the budget', () => {
		const exhausted = run([
			{ kind: 'faultObserved' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
			{ kind: 'attemptTimeout' },
		]).state;
		const { state } = run([{ kind: 'connected' }], exhausted);
		expect(state).toEqual(initialAutoReconnectState);
	});

	it('ignores a stale timeout when no attempt is pending', () => {
		const { state, results } = run([{ kind: 'attemptTimeout' }]);
		expect(state).toEqual(initialAutoReconnectState);
		expect(results[0]?.verdict.shouldAttempt).toBe(false);
	});

	it('does not mutate the input state', () => {
		const frozen = Object.freeze({ ...initialAutoReconnectState });
		reduceAutoReconnect(frozen, { kind: 'faultObserved' });
		expect(frozen).toEqual(initialAutoReconnectState);
	});
});
