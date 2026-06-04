/**
 * Connection Advisory open-state reducer (PRD #75, slice #78).
 *
 * A pure reducer — modelled on the celebration queue's pure state machine — that
 * governs *when* the Connection Advisory popover is open, implementing a
 * per-episode dismiss latch so the advisory informs without nagging.
 *
 * An **episode** is one continuous fault. The reducer consumes transition events
 * and outputs `{ open, episodeId }` (plus an internal `dismissed` latch):
 *
 * - A fault entered (the signal-kind edge into offline/reconnecting) auto-opens
 *   the advisory and begins a new episode.
 * - Dismissing closes the advisory and latches it shut for the rest of that
 *   episode — a repeated fault edge within the same episode never re-nags.
 * - Recovery (connected/discovering) or stream end closes the advisory and ends
 *   the episode; faulting again afterwards starts a fresh episode that re-opens.
 * - The user can reopen on demand (clicking the ConnectionSignal bars) after
 *   dismissing — the latch persists, so it stays a manual-only reopen.
 *
 * Fully decoupled from rendering so it can be unit-tested in isolation.
 */

export interface AdvisoryOpenState {
	/** Whether the advisory popover is currently open. */
	open: boolean;
	/**
	 * Monotonic id of the most recent fault episode. `0` means no episode has
	 * ever started; it increments on each new fault edge and never decreases, so
	 * a fresh episode always reports a higher id than the one before it.
	 */
	episodeId: number;
	/** Whether the user has dismissed the advisory for the current episode. */
	dismissed: boolean;
	/**
	 * Whether a fault episode is currently active (a fault has been entered and
	 * not yet recovered). Tracked separately from `episodeId` so the latter can
	 * stay monotonic across episodes.
	 */
	faulting: boolean;
}

export type AdvisoryOpenEvent =
	/**
	 * The signal kind transitioned *into* a fault (offline/reconnecting). While
	 * `suppressed` (Auto-Reconnect is silently retrying, ADR-0009), the edge starts
	 * no episode and the advisory stays closed; the "Reconnecting" signal bars
	 * still show. When suppression lifts on exhaustion the host re-fires this edge
	 * un-suppressed, opening the advisory as a normal fault.
	 */
	| { kind: 'faultEntered'; suppressed?: boolean }
	/** The connection recovered (connected/discovering) or the stream ended. */
	| { kind: 'recovered' }
	/** The user dismissed the advisory (click-away or clicking the open bars). */
	| { kind: 'dismissed' }
	/** The user clicked the ConnectionSignal bars to reopen on demand. */
	| { kind: 'reopened' };

export const initialAdvisoryOpenState: AdvisoryOpenState = {
	open: false,
	episodeId: 0,
	dismissed: false,
	faulting: false,
};

export function reduceAdvisoryOpenState(
	state: AdvisoryOpenState,
	event: AdvisoryOpenEvent,
): AdvisoryOpenState {
	switch (event.kind) {
		case 'faultEntered':
			return enterFault(state, event.suppressed ?? false);
		case 'recovered':
			return recover(state);
		case 'dismissed':
			return dismiss(state);
		case 'reopened':
			return reopen(state);
		default:
			return state;
	}
}

function enterFault(state: AdvisoryOpenState, suppressed: boolean): AdvisoryOpenState {
	// Suppressed by Auto-Reconnect: start no episode and stay closed. The fault is
	// real (the bars show "Reconnecting"), but the advisory waits until suppression
	// lifts, at which point the host re-fires this edge un-suppressed.
	if (suppressed) {
		return state;
	}

	// Already inside an episode: this is a redundant fault edge, not a new
	// episode. Honour the dismiss latch — never re-nag — and leave state as is.
	if (state.faulting) {
		return state;
	}

	// A genuinely new fault edge: start a fresh episode and auto-open.
	return { open: true, episodeId: state.episodeId + 1, dismissed: false, faulting: true };
}

function recover(state: AdvisoryOpenState): AdvisoryOpenState {
	// Recovery (or stream end) closes the advisory and ends the episode, clearing
	// the latch so the next fault may auto-open again. `episodeId` is preserved so
	// it stays monotonic across episodes.
	if (!state.faulting && !state.open) {
		return state;
	}

	return { open: false, episodeId: state.episodeId, dismissed: false, faulting: false };
}

function dismiss(state: AdvisoryOpenState): AdvisoryOpenState {
	if (!state.open) {
		return state;
	}

	return { ...state, open: false, dismissed: true };
}

function reopen(state: AdvisoryOpenState): AdvisoryOpenState {
	// Manual reopen only applies while a fault episode is active; if recovered,
	// there is nothing to reopen.
	if (!state.faulting || state.open) {
		return state;
	}

	return { ...state, open: true };
}
