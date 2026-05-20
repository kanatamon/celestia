import type { LiveEvent } from '@celestia/tiktok-live-core';
import type {
	ChromeDebuggerTransport,
	Debuggee,
} from '../src/chrome-extension/chrome-debugger-transport.js';
import {
	ChromeExtensionTikTokLiveProvider,
	type LiveIngestionTraceDocument,
} from '../src/index.js';
import { bytes, event, frameBase64, msg, responseMessage, str, user } from './protobuf-fixtures.js';

class FakeTransport implements ChromeDebuggerTransport {
	tab: ChromeApi.Tab = { id: 42, url: 'https://www.tiktok.com/@creator/live?token=secret' };
	eventHandler:
		| ((source: Debuggee, method: string, params?: Record<string, unknown>) => void)
		| undefined;
	detachHandler: ((source: Debuggee, reason: string) => void) | undefined;

	async queryActiveTab(): Promise<ChromeApi.Tab> {
		return this.tab;
	}

	async attach(): Promise<void> {}

	async detach(): Promise<void> {}

	async enableNetwork(): Promise<void> {}

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
let now = Date.UTC(2026, 4, 20, 12, 0, 0);
const events: LiveEvent[] = [];
const provider = new ChromeExtensionTikTokLiveProvider({
	transport,
	browserEvents: undefined,
	now: () => now,
	setTimeout: ((handler: () => void) => ({ handler })) as unknown as typeof setTimeout,
	clearTimeout: (() => {}) as typeof clearTimeout,
	trace: {
		enabled: true,
		extensionVersion: '1.0.0',
	},
});
provider.onEvent((event) => events.push(event));

await provider.attachActiveTab('creator');
now += 10;
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketCreated', {
	requestId: 'socket-1',
	url: 'wss://webcast-ws.tiktok.com/webcast/im/ws_proxy/?session=secret',
});
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketWillSendHandshakeRequest', {
	requestId: 'socket-1',
	request: {
		url: 'wss://webcast-ws.tiktok.com/webcast/im/ws_proxy/?session=secret',
		headers: { Cookie: 'never-store' },
	},
});
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketHandshakeResponseReceived', {
	requestId: 'socket-1',
	response: {
		status: 101,
		headers: { 'set-cookie': 'never-store' },
	},
});
const payloadData = frameBase64([
	responseMessage(
		'WebcastChatMessage',
		msg([bytes(1, event(101)), bytes(2, user(1001)), str(3, 'secret chat text')]),
	),
]);
now += 5;
transport.eventHandler?.({ tabId: 42 }, 'Network.webSocketFrameReceived', {
	requestId: 'socket-1',
	response: { payloadData },
});

if (events.length !== 1) {
	throw new Error(`Expected one LiveEvent before trace export, got ${events.length}`);
}

const disabledProvider = new ChromeExtensionTikTokLiveProvider({
	transport: new FakeTransport(),
	browserEvents: undefined,
});
if ((await disabledProvider.exportTraceJson()) !== undefined) {
	throw new Error('Expected trace export to be unavailable unless trace mode is enabled');
}

const trace = JSON.parse((await provider.exportTraceJson()) ?? '') as LiveIngestionTraceDocument;
if (trace.schema !== 'celestia-trace-v1') throw new Error('Expected trace schema marker');
if (trace.extension.version !== '1.0.0' || trace.extension.build !== 'illegal-v2') {
	throw new Error(`Expected extension markers, got ${JSON.stringify(trace.extension)}`);
}
if (!trace.usernameHash?.startsWith('sha256:')) {
	throw new Error('Expected username to be hashed');
}

const attached = trace.events.find((event) => event.kind === 'debugger_attached');
if (attached?.kind !== 'debugger_attached' || !attached.tabUrlHash?.startsWith('sha256:')) {
	throw new Error('Expected debugger attach event with hashed tab URL');
}
const socketCreated = trace.events.find((event) => event.kind === 'socket_created');
if (
	socketCreated?.kind !== 'socket_created' ||
	socketCreated.urlOrigin !== 'wss://webcast-ws.tiktok.com' ||
	socketCreated.urlPath !== '/webcast/im/ws_proxy/' ||
	!socketCreated.urlQueryHash?.startsWith('sha256:') ||
	socketCreated.matchesLivePattern !== true
) {
	throw new Error(`Expected sanitized socket_created event, got ${JSON.stringify(socketCreated)}`);
}
if (!trace.events.some((event) => event.kind === 'socket_handshake_request')) {
	throw new Error('Expected handshake request trace event');
}
const handshakeResponse = trace.events.find((event) => event.kind === 'socket_handshake_response');
if (
	handshakeResponse?.kind !== 'socket_handshake_response' ||
	handshakeResponse.statusCode !== 101
) {
	throw new Error('Expected handshake response status code');
}

const frame = trace.events.find((event) => event.kind === 'frame_received');
if (
	frame?.kind !== 'frame_received' ||
	frame.route !== 'known_live' ||
	frame.decodeSummary.outcome !== 'success' ||
	frame.decodeSummary.messageTypes[0] !== 'WebcastChatMessage' ||
	frame.decodeSummary.liveEventTypes[0] !== 'chat' ||
	!frame.syntheticPayloadBase64
) {
	throw new Error(`Expected decoded frame summary, got ${JSON.stringify(frame)}`);
}
if (frame.syntheticPayloadBase64 === payloadData) {
	throw new Error('Expected synthetic payload to differ from the raw WebSocket payload');
}

const liveEvent = trace.events.find((event) => event.kind === 'live_event_emitted');
if (
	liveEvent?.kind !== 'live_event_emitted' ||
	liveEvent.eventType !== 'chat' ||
	!liveEvent.eventIdHash.startsWith('sha256:') ||
	!liveEvent.userIdHash?.startsWith('sha256:')
) {
	throw new Error(`Expected sanitized LiveEvent summary, got ${JSON.stringify(liveEvent)}`);
}
if (!trace.events.some((event) => event.kind === 'state_transition' && event.to === 'connected')) {
	throw new Error('Expected connected state transition');
}

const serialized = JSON.stringify(trace);
for (const forbidden of ['secret chat text', 'session=secret', 'token=secret', payloadData]) {
	if (serialized.includes(forbidden)) {
		throw new Error(`Trace leaked forbidden value: ${forbidden}`);
	}
}
