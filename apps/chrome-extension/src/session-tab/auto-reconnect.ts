/**
 * Auto-Reconnect policy reducer (ADR-0009, PRD #86 §Auto-Reconnect).
 *
 * A pure deep module that decides how the Session Tab silently recovers from a
 * `reconnecting` fault (`interrupted`/`stale`) **while the paired tab is still on
 * the live**, so a self-healing blip never nags the user with a popover. Modeled
 * on the other Session-Tab reducers (`advisory-open-state.ts`,
 * `synthesized-celebration-trigger.ts`): no rendering, no Chrome, no timers —
 * just `(state, event) → { state, verdict }`.
 *
 * Why a budget reducer rather than a retry loop in the Provider: an attempt **is**
 * a remount of `LiveFeed` (the existing manual-Reconnect mechanism — re-attach,
 * re-discover), which destroys and recreates the Provider. A budget living below
 * that boundary would reset every attempt and loop forever, so the budget lives
 * in the Session Tab, above the remount (ADR-0009 Decision §2).
 *
 * The verdict drives the host:
 * - `shouldAttempt` — an **edge** (true only on the event that initiates an
 *   attempt) telling the Session Tab to remount now.
 * - `attemptsRemaining` — budget left, for diagnostics/tests.
 * - `suppressAdvisory` — whether the Connection Advisory stays suppressed (true
 *   while silently retrying; false once exhausted so the advisory opens, and
 *   false when idle).
 *
 * Liveness is read straight from the fault `reason`: the classifier (ADR-0009 §1)
 * raises `off-live` in precedence over `interrupted`/`stale`, so an `interrupted`
 * or `stale` fault already implies the tab is still on the live. A mid-retry
 * change to `off-live`/`offline` (or a stream end) arrives here as `abandoned`.
 */

/** Silent attempts spent before the advisory is owed (ADR-0009: fixed 3). */
export const AUTO_RECONNECT_MAX_ATTEMPTS = 3;

/**
 * Per-attempt timeout before an attempt counts as failed (~6s). Deliberately
 * shorter than the Provider's 10s promiscuous-decode delay — those sockets
 * recover via the patient manual Reconnect after exhaustion, not here.
 */
export const AUTO_RECONNECT_ATTEMPT_TIMEOUT_MS = 6000;

/** Quiet gap between attempts (~1s). 3 attempts × 6s + 2 gaps ≈ 20s worst case. */
export const AUTO_RECONNECT_GAP_MS = 1000;

export type AutoReconnectEvent =
	/** A `reconnecting` (`interrupted`/`stale`) fault while the tab is still live. */
	| { kind: 'faultObserved' }
	/** The connection reached `connected` — the attempt (or the live) succeeded. */
	| { kind: 'connected' }
	/** The per-attempt timeout elapsed without reaching `connected`. */
	| { kind: 'attemptTimeout' }
	/**
	 * The fault changed out from under us — `off-live`, `offline`, or stream end.
	 * Auto-Reconnect hands off to that reason's path.
	 */
	| { kind: 'abandoned' };

export interface AutoReconnectState {
	/** Silent attempts still available in this episode. */
	attemptsRemaining: number;
	/** An episode is active: attempts are being made and the advisory is suppressed. */
	retrying: boolean;
	/** An attempt has been initiated and we are awaiting its outcome or timeout. */
	attemptPending: boolean;
	/** The budget is spent: stop suppressing so the advisory opens (un-timed manual). */
	exhausted: boolean;
}

export interface AutoReconnectVerdict {
	/** Edge — true only on the event that initiates an attempt (host should remount). */
	shouldAttempt: boolean;
	attemptsRemaining: number;
	/** Whether the Connection Advisory should stay suppressed. */
	suppressAdvisory: boolean;
}

export interface AutoReconnectResult {
	state: AutoReconnectState;
	verdict: AutoReconnectVerdict;
}

export const initialAutoReconnectState: AutoReconnectState = {
	attemptsRemaining: AUTO_RECONNECT_MAX_ATTEMPTS,
	retrying: false,
	attemptPending: false,
	exhausted: false,
};

export function reduceAutoReconnect(
	state: AutoReconnectState,
	event: AutoReconnectEvent,
): AutoReconnectResult {
	switch (event.kind) {
		case 'faultObserved':
			return onFault(state);
		case 'attemptTimeout':
			return state.attemptPending ? failAttempt(state) : steady(state);
		case 'connected':
		case 'abandoned':
			// Success resets the budget for a future unrelated fault; abandon hands off
			// to the new reason's path. Both return to a clean idle.
			return settled();
		default:
			return steady(state);
	}
}

function onFault(state: AutoReconnectState): AutoReconnectResult {
	// Already exhausted: the advisory is open and the manual Reconnect is the path.
	// A re-fault from that one-shot must NOT restart the auto cycle.
	if (state.exhausted) {
		return steady(state);
	}

	// A fault while an attempt is in flight means that attempt failed (re-faulted).
	if (state.attemptPending) {
		return failAttempt(state);
	}

	// A fresh fault edge for an idle reducer: begin the episode.
	return initiateAttempt(state);
}

function failAttempt(state: AutoReconnectState): AutoReconnectResult {
	if (state.attemptsRemaining > 0) {
		return initiateAttempt(state);
	}

	// Budget spent: stop suppressing so the advisory opens with an un-timed manual
	// Reconnect.
	const exhausted: AutoReconnectState = {
		attemptsRemaining: 0,
		retrying: false,
		attemptPending: false,
		exhausted: true,
	};
	return { state: exhausted, verdict: verdictFor(exhausted, false) };
}

function initiateAttempt(state: AutoReconnectState): AutoReconnectResult {
	const next: AutoReconnectState = {
		attemptsRemaining: state.attemptsRemaining - 1,
		retrying: true,
		attemptPending: true,
		exhausted: false,
	};
	return { state: next, verdict: verdictFor(next, true) };
}

function settled(): AutoReconnectResult {
	return {
		state: initialAutoReconnectState,
		verdict: verdictFor(initialAutoReconnectState, false),
	};
}

function steady(state: AutoReconnectState): AutoReconnectResult {
	return { state, verdict: verdictFor(state, false) };
}

function verdictFor(state: AutoReconnectState, shouldAttempt: boolean): AutoReconnectVerdict {
	return {
		shouldAttempt,
		attemptsRemaining: state.attemptsRemaining,
		suppressAdvisory: state.retrying,
	};
}
