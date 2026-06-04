import type { ConnectionState, ConnectionStateReason } from '@celestia/tiktok-live-core';

/**
 * The five-kind visual projection of a {@link ConnectionState}. The
 * **ConnectionSignal** bars and username gradient read `kind`; the **Connection
 * Advisory** branches on `reason` for its copy and action.
 */
export type ConnectionSignalKind =
	| 'discovering'
	| 'connected'
	| 'offline'
	| 'reconnecting'
	| 'ended';

export interface ConnectionSignalViewModel {
	label: string;
	kind: ConnectionSignalKind;
	/** The precise fault cause, present only while the signal is a fault kind. */
	reason?: ConnectionStateReason;
}

type ActiveConnectionState = ConnectionState & {
	status: Exclude<ConnectionState['status'], 'idle'>;
};

/**
 * Project an active {@link ConnectionState} onto the ConnectionSignal view-model,
 * carrying the `reason` through so the Connection Advisory can branch on the
 * precise cause. Pure.
 */
export function toConnectionSignalViewModel(
	state: ActiveConnectionState,
): ConnectionSignalViewModel {
	switch (state.status) {
		case 'attaching':
		case 'attached':
		case 'connecting':
		case 'detaching':
		case 'disconnecting':
			return { label: 'Discovering', kind: 'discovering' };
		case 'connected':
			return { label: 'Connected', kind: 'connected' };
		case 'error':
			if (state.reason === 'offline') {
				return { label: 'Offline', kind: 'offline', reason: 'offline' };
			}
			return { label: 'Reconnecting', kind: 'reconnecting', reason: state.reason };
		case 'detached':
		case 'disconnected':
			return { label: 'Stream Ended', kind: 'ended' };
	}
}

/** The signal kinds the Connection Advisory auto-opens for. */
export function isAdvisoryFaultKind(kind: ConnectionSignalKind): boolean {
	return kind === 'offline' || kind === 'reconnecting';
}

/** The per-state colour accent the advisory renders. */
export type ConnectionAdvisoryAccent = 'red' | 'amber';

export interface ConnectionAdvisoryContent {
	/** The headline naming the fault. */
	title: string;
	/** Plain-language explanation of why the fault happened. */
	why: string;
	/** What the user (or Celestia) can do about it. */
	workaround: string;
	/** Secondary fallback copy, shown when a first action may not be enough. */
	secondary?: string;
	/** The Reconnect action label, omitted when no action can fix the fault. */
	actionLabel?: string;
	/** The colour accent matching the fault severity. */
	accent: ConnectionAdvisoryAccent;
}

/**
 * Map a fault {@link ConnectionStateReason} to the Connection Advisory copy and
 * whether a Reconnect action is offered. Pure; fully decoupled from rendering.
 *
 * - `offline` — device lost network; Celestia resumes automatically. No action.
 * - `off-live` — the paired tab is still attached but has navigated off the live
 *   page. Reopen-live action navigates that same tab back to this streamer.
 * - `interrupted` — Chrome Debugger detached. Reconnect action.
 * - `stale` — debugger attached but no LiveEvents past the stale threshold.
 *   Reconnect action, plus a close-tabs-and-relaunch fallback.
 *
 * An unknown/absent reason falls back to the `interrupted` copy — the generic
 * "events stopped, try reconnecting" case for a `reconnecting` signal.
 */
export function resolveConnectionAdvisoryContent(
	reason: ConnectionStateReason | undefined,
): ConnectionAdvisoryContent {
	switch (reason) {
		case 'offline':
			return {
				title: 'You went offline',
				why: 'Your device lost its network connection, so events stopped arriving.',
				workaround: 'No action needed — Celestia will resume automatically once you reconnect.',
				accent: 'red',
			};
		case 'off-live':
			return {
				title: 'You left the live',
				why: 'The paired TikTok tab navigated away from the live page, so the live feed stopped. Celestia is still attached to that tab.',
				workaround: 'Reopen live to take that same tab back to this streamer and resume the feed.',
				actionLabel: 'Reopen live',
				accent: 'amber',
			};
		case 'stale':
			return {
				title: 'Stream may have stalled',
				why: 'Celestia is still attached, but no new events have arrived for a while. The stream may have stopped sending.',
				workaround: 'Reconnect to re-establish the live feed.',
				secondary:
					'If it keeps stalling, close this tab and the TikTok Live tab, then relaunch from the Launcher.',
				actionLabel: 'Reconnect',
				accent: 'amber',
			};
		default:
			return {
				title: 'Connection interrupted',
				why: 'Celestia stopped receiving events — usually because the "Celestia is debugging this browser" banner was dismissed, or DevTools was opened on the TikTok tab.',
				workaround: 'Reconnect to re-attach and resume the live feed.',
				actionLabel: 'Reconnect',
				accent: 'amber',
			};
	}
}
