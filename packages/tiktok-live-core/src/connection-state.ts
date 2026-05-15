export type ConnectionStateStatus =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'disconnecting'
	| 'disconnected'
	| 'error';

export interface ConnectionState {
	status: ConnectionStateStatus;
	username: string;
	viewerCount?: number;
}
