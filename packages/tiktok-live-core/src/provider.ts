import type { ConnectionState } from './connection-state.js';
import type { LiveEvent } from './live-event.js';
import type { ProviderLog } from './types.js';

export type Unsubscribe = () => void;

export interface TikTokLiveProvider {
	connect(username: string): Promise<ConnectionState>;
	disconnect(): Promise<ConnectionState>;
	getConnectionState(): ConnectionState;
	onEvent(handler: (event: LiveEvent) => void): Unsubscribe;
	onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe;
	onLog(handler: (log: ProviderLog) => void): Unsubscribe;
	destroy(): void;
}
