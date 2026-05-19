import type { LiveEvent, ProviderLog } from '@celestia/tiktok-live-core';
import type {
	ChromeDebuggerTransport,
	Debuggee,
} from '../src/chrome-extension/chrome-debugger-transport.js';
import { type ChromeConnectionState, ChromeExtensionTikTokLiveProvider } from '../src/index.js';
import {
	bytes,
	event,
	frameBase64,
	msg,
	responseMessage,
	str,
	uint,
	user,
} from './protobuf-fixtures.js';

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

class FakeBrowserEvents {
	online = true;
	private readonly listeners = new Map<'online' | 'offline', Set<() => void>>();

	addEventListener(type: 'online' | 'offline', handler: () => void): void {
		const listeners = this.listeners.get(type) ?? new Set<() => void>();
		listeners.add(handler);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type: 'online' | 'offline', handler: () => void): void {
		this.listeners.get(type)?.delete(handler);
	}

	emit(type: 'online' | 'offline'): void {
		for (const handler of this.listeners.get(type) ?? []) handler();
	}
}

const transport = new FakeTransport();
const browserEvents = new FakeBrowserEvents();
let now = 1;
const timers: Array<{ handler: () => void; delay: number; active: boolean }> = [];
const provider = new ChromeExtensionTikTokLiveProvider({
	transport,
	browserEvents,
	now: () => now,
	setTimeout: ((handler: () => void, delay?: number) => {
		const timer = { handler, delay: delay ?? 0, active: true };
		timers.push(timer);
		return timer;
	}) as unknown as typeof setTimeout,
	clearTimeout: ((timer: { active?: boolean }) => {
		timer.active = false;
	}) as typeof clearTimeout,
	staleEventThresholdMs: 20,
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
if (timers.find((timer) => timer.delay === 10_000)?.active) {
	throw new Error('Expected confirmed WebSocket to prevent promiscuous mode');
}

browserEvents.online = false;
browserEvents.emit('offline');
assertState(
	provider.getConnectionState(),
	{ status: 'error', reason: 'offline' },
	'Expected offline browser event to immediately mark the provider offline',
);

browserEvents.online = true;
browserEvents.emit('online');
assertState(
	provider.getConnectionState(),
	{ status: 'attached' },
	'Expected online browser event to return to discovery, not connected',
);

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-1',
	response: {
		payloadData: frameBase64([
			responseMessage(
				'WebcastChatMessage',
				msg([bytes(1, event(103)), bytes(2, user()), str(3, 'fresh after online')]),
			),
		]),
	},
});
assertState(
	provider.getConnectionState(),
	{ status: 'connected' },
	'Expected fresh LiveEvent after rediscovery to reconnect the provider',
);

const activeStaleTimer = lastActiveTimer(20);
now = 22;
activeStaleTimer.handler();
assertState(
	provider.getConnectionState(),
	{ status: 'error', reason: 'stale' },
	'Expected stale timer to classify missing LiveEvents as stale',
);

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-1',
	response: {
		payloadData: frameBase64([
			responseMessage(
				'WebcastChatMessage',
				msg([bytes(1, event(104)), bytes(2, user()), str(3, 'resets stale timer')]),
			),
		]),
	},
});
assertState(
	provider.getConnectionState(),
	{ status: 'connected' },
	'Expected new decoded LiveEvent to reset stale classification',
);
if (activeStaleTimer?.active) {
	throw new Error('Expected new decoded LiveEvent to clear the previous stale timer');
}

transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-1',
	response: {
		payloadData: frameBase64([responseMessage('WebcastControlMessage', msg([uint(2, 3)]))]),
	},
});
assertState(
	provider.getConnectionState(),
	{ status: 'disconnected' },
	'Expected stream-end LiveEvent to classify as disconnected',
);

await provider.attach(42, 'creator');
transport.detachHandler?.({ tabId: 42 }, 'target_closed');
assertState(
	provider.getConnectionState(),
	{ status: 'error', reason: 'interrupted' },
	'Expected unexpected debugger detach to classify as interrupted',
);

await provider.attach(42, 'creator');

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

const errorStateLogs = logs.filter(
	(log) => log.message === 'Connection state changed' && log.details?.to === 'error',
);
if (
	!errorStateLogs.every(
		(log) => log.details?.reason !== undefined && 'lastDecodedEventAt' in (log.details ?? {}),
	)
) {
	throw new Error(
		'Expected error state transition logs to include reason and last event timestamp',
	);
}

function assertState(
	actual: ChromeConnectionState,
	expected: Pick<ChromeConnectionState, 'status' | 'reason'>,
	message: string,
): void {
	if (actual.status !== expected.status || actual.reason !== expected.reason) {
		throw new Error(`${message}: got ${JSON.stringify(actual)}`);
	}
}

function assertLength(items: { length: number }, expected: number, message: string): void {
	if (items.length !== expected) {
		throw new Error(message);
	}
}

function lastActiveTimer(delay: number): { handler: () => void; active: boolean } {
	const timer = timers.findLast((timer) => timer.active && timer.delay === delay);
	if (timer === undefined) {
		throw new Error(`Expected active timer with ${delay}ms delay`);
	}
	return timer;
}
