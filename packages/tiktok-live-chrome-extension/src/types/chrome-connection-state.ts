import type { ConnectionState } from '@celestia/tiktok-live-core';

export interface ChromeConnectionState extends Omit<ConnectionState, 'status'> {
	status: 'idle' | 'attaching' | 'attached' | 'connected' | 'detaching' | 'detached' | 'error';
	tabId?: number;
	tabUrl?: string;
	attachedAt?: number;
	socketCount: number;
	confirmedSocketRequestId?: string;
	confirmedSocketUrl?: string;
	lastDecodedEventAt?: number;
	eventCount: number;
	decodeFailures: number;
	promiscuousMode: boolean;
}
