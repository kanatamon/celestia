import type { ConnectionState } from '@celestia/tiktok-live-core';

export interface ConnectionClassificationSignals {
	online: boolean;
	debuggerAttached: boolean;
	confirmedSocket: boolean;
	lastEventAt: number | undefined;
	staleThresholdMs: number;
	streamEnded: boolean;
	now: number;
	username?: string;
	viewerCount?: number;
	/**
	 * Whether the paired tab's URL is still a `/@user/live` page. The Chrome
	 * Extension Provider supplies this by watching `chrome.tabs.onUpdated` and
	 * re-evaluating the tab URL. Optional — absent means "assume live" so callers
	 * that never observe navigation behave exactly as before.
	 */
	tabIsLive?: boolean;
	/**
	 * Latched true once the Provider has reached a confirmed-live `connected`
	 * state at least once. Gates the `off-live` fault so a cold attach to a
	 * not-yet-live (or non-live) tab never raises it — only a tab that *left* a
	 * live it had reached does. Optional; absent means "never connected".
	 */
	everConnectedLive?: boolean;
}

export function classifyConnectionState(signals: ConnectionClassificationSignals): ConnectionState {
	const baseState: Pick<ConnectionState, 'username' | 'viewerCount'> = {
		username: signals.username ?? '',
		viewerCount: signals.viewerCount,
	};

	if (signals.streamEnded) {
		return { ...baseState, status: 'disconnected' };
	}

	if (!signals.online) {
		return { ...baseState, status: 'error', reason: 'offline' };
	}

	// The paired tab navigated off the live after we had a confirmed-live
	// connection. This dominates the downstream "debugger detached" / "no events"
	// symptoms (those are consequences of leaving the live, not the real cause),
	// but stays below `offline` because a URL read is untrustworthy with no
	// network. Gated on `everConnectedLive` so a cold non-live/loading attach
	// spins on Discovering instead of falsely raising off-live (ADR-0009).
	if (signals.tabIsLive === false && signals.everConnectedLive === true) {
		return { ...baseState, status: 'error', reason: 'off-live' };
	}

	if (!signals.debuggerAttached) {
		return { ...baseState, status: 'error', reason: 'interrupted' };
	}

	if (!signals.confirmedSocket || signals.lastEventAt === undefined) {
		return { ...baseState, status: 'connecting' };
	}

	if (signals.now - signals.lastEventAt >= signals.staleThresholdMs) {
		return { ...baseState, status: 'error', reason: 'stale' };
	}

	return { ...baseState, status: 'connected' };
}
