import type { LiveEvent, ProviderLog } from '@celestia/tiktok-live-core';
import type {
	ChromeDebuggerTransport,
	Debuggee,
} from '../src/chrome-extension/chrome-debugger-transport.js';
import { type ChromeConnectionState, ChromeExtensionTikTokLiveProvider } from '../src/index.js';
import { bytes, event, frameBase64, msg, responseMessage, str, user } from './protobuf-fixtures.js';

class FakeTransport implements ChromeDebuggerTransport {
	events: Array<[Debuggee, string, Record<string, unknown> | undefined]> = [];
	detaches: Debuggee[] = [];
	tab: ChromeApi.Tab = { id: 42, url: 'https://www.tiktok.com/@creator/live' };
	eventHandler:
		| ((source: Debuggee, method: string, params?: Record<string, unknown>) => void)
		| undefined;
	detachHandler: ((source: Debuggee, reason: string) => void) | undefined;

	async queryActiveTab(): Promise<ChromeApi.Tab> {
		return this.tab;
	}

	async attach(debuggee: Debuggee): Promise<void> {
		this.events.push([debuggee, 'attach', undefined]);
	}

	async detach(debuggee: Debuggee): Promise<void> {
		this.detaches.push(debuggee);
	}

	async enableNetwork(debuggee: Debuggee): Promise<void> {
		this.events.push([debuggee, 'Network.enable', undefined]);
	}

	addEventListener(
		handler: (source: Debuggee, method: string, params?: Record<string, unknown>) => void,
	): void {
		this.eventHandler = handler;
	}

	removeEventListener(): void {
		this.eventHandler = undefined;
	}

	addDetachListener(handler: (source: Debuggee, reason: string) => void): void {
		this.detachHandler = handler;
	}

	removeDetachListener(): void {
		this.detachHandler = undefined;
	}
}

const transport = new FakeTransport();
const timers: Array<() => void> = [];
const provider = new ChromeExtensionTikTokLiveProvider({
	transport,
	now: () => 1,
	setTimeout: ((handler: () => void) => {
		timers.push(handler);
		return 1;
	}) as typeof setTimeout,
	clearTimeout: (() => {}) as typeof clearTimeout,
});

const states: ChromeConnectionState[] = [];
const events: LiveEvent[] = [];
const logs: ProviderLog[] = [];
provider.onConnectionState((state) => states.push(state as ChromeConnectionState));
provider.onEvent((event) => events.push(event));
provider.onLog((log) => logs.push(log));

await provider.attach(42, 'creator');
if (provider.getConnectionState().status !== 'attached') {
	throw new Error('Expected provider to attach to the requested tab');
}
if (transport.events.length !== 2) {
	throw new Error('Expected attach flow to attach the debugger and enable Network events');
}

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketCreated', {
	requestId: 'socket-noise',
	url: 'wss://example.test/socket',
});
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-noise',
	response: {
		payloadData: frameBase64([
			responseMessage(
				'WebcastChatMessage',
				msg([bytes(1, event(100)), bytes(2, user()), str(3, 'ignored before promiscuous mode')]),
			),
		]),
	},
});

assertLength(
	events,
	0,
	'Expected non-preferred WebSocket frames to be ignored before promiscuous mode',
);

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketCreated', {
	requestId: 'socket-1',
	url: 'wss://webcast-ws.tiktok.com/webcast/im/ws_proxy/',
});
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-1',
	response: {
		payloadData: frameBase64([
			responseMessage(
				'WebcastChatMessage',
				msg([bytes(1, event(101)), bytes(2, user()), str(3, 'hello from provider')]),
			),
		]),
	},
});

assertLength(events, 1, 'Expected preferred WebSocket frame to emit a LiveEvent');
if (
	provider.getConnectionState().confirmedSocketRequestId !== 'socket-1' ||
	provider.getConnectionState().confirmedSocketUrl !==
		'wss://webcast-ws.tiktok.com/webcast/im/ws_proxy/'
) {
	throw new Error('Expected provider to confirm the decoding WebSocket identity');
}
if (provider.getConnectionState().status !== 'connected') {
	throw new Error('Expected decoded TikTok Live events to mark the provider connected');
}

timers[0]?.();
if (provider.getConnectionState().promiscuousMode) {
	throw new Error('Expected confirmed WebSocket to prevent promiscuous mode');
}

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketCreated', {
	requestId: 'socket-2',
	url: 'wss://webcast-ws.tiktok.com/webcast/im/ws_proxy/',
});
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-2',
	response: {
		payloadData: frameBase64([
			responseMessage(
				'WebcastChatMessage',
				msg([bytes(1, event(102)), bytes(2, user()), str(3, 'same URL different request')]),
			),
		]),
	},
});
assertLength(events, 1, 'Expected same-URL WebSocket frames with a new request ID to be ignored');

await provider.attach(84, 'other');
if (transport.detaches.length !== 1 || transport.detaches[0]?.tabId !== 42) {
	throw new Error('Expected reattaching to a different tab to detach the previous debugger');
}
if (provider.getConnectionState().confirmedSocketRequestId !== undefined) {
	throw new Error('Expected attach to clear the confirmed WebSocket request ID');
}
if (provider.getConnectionState().eventCount !== 1) {
	throw new Error('Expected attach to preserve LiveEvent counters');
}

await provider.detach();
if (provider.getConnectionState().status !== 'detached') {
	throw new Error('Expected detach to update provider state');
}
assertLength(transport.detaches, 2, 'Expected detach to call Chrome debugger detach');

logs satisfies ProviderLog[];

function assertLength(items: { length: number }, expected: number, message: string): void {
	if (items.length !== expected) {
		throw new Error(message);
	}
}
