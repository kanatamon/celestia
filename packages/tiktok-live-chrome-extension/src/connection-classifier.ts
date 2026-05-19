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
