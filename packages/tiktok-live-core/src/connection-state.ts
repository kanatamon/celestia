export type ConnectionStateStatus =
	| 'idle'
	| 'attaching'
	| 'attached'
	| 'connecting'
	| 'connected'
	| 'detaching'
	| 'disconnecting'
	| 'detached'
	| 'disconnected'
	| 'error';

export type ConnectionStateReason = 'offline' | 'interrupted' | 'stale';

export interface ConnectionState {
	status: ConnectionStateStatus;
	username: string;
	viewerCount?: number;
	reason?: ConnectionStateReason;
}
