export type ProviderStatus =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'disconnecting'
	| 'disconnected'
	| 'error';

export interface ConnectionState {
	status: ProviderStatus;
	username: string;
	viewerCount?: number;
}
