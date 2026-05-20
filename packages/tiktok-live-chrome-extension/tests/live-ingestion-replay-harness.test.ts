import type { LiveEvent } from '@celestia/tiktok-live-core';
import type { LiveIngestionTraceDocument } from '../src/index.js';
import { replayLiveIngestionTrace } from './live-ingestion-replay-harness.js';
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

type TraceEvent = LiveIngestionTraceDocument['events'][number];
type FrameTraceEvent = Extract<TraceEvent, { kind: 'frame_received' }>;
type LiveEventTraceEvent = Extract<TraceEvent, { kind: 'live_event_emitted' }>;
type SocketCreatedTraceEvent = Extract<TraceEvent, { kind: 'socket_created' }>;
type StateTransitionTraceEvent = Extract<TraceEvent, { kind: 'state_transition' }>;
type ChromeTraceStatus = StateTransitionTraceEvent['to'];

const trace = traceDocument([
	{ kind: 'debugger_attached', elapsedMs: 0, tabId: 42, tabUrlHash: 'sha256:11111111' },
	{ kind: 'network_enabled', elapsedMs: 1 },
	transition('idle', 'attaching', 0, 0),
	transition('attaching', 'attached', 1, 0),
	frame('unmapped-live', 10, 'socket-before-attach', 'unmapped_candidate', [
		responseMessage(
			'WebcastChatMessage',
			msg([bytes(1, event(200)), bytes(2, user()), str(3, 'sanitized away')]),
		),
	]),
	transition('attached', 'connected', 11, 0, 'socket-before-attach'),
	liveEvent('chat', 11, 'WebcastChatMessage'),
	frame('empty', 12, 'socket-before-attach', 'confirmed', []),
	frame('malformed-unmapped', 13, 'unmapped-noise', 'unmapped_candidate', undefined, 'AA=='),
	socketCreated(20, 'socket-rotated'),
	frame('rotated-live', 21, 'socket-rotated', 'known_live', [
		responseMessage(
			'WebcastMemberMessage',
			msg([bytes(1, event(201)), bytes(2, user()), uint(10, 52)]),
		),
	]),
	liveEvent('member', 22, 'WebcastMemberMessage'),
	frame('malformed-known', 23, 'socket-rotated', 'known_live', undefined, 'AA=='),
]);

const result = await replayLiveIngestionTrace(JSON.stringify(trace));

assertArray(
	result.liveEventTypes,
	['chat', 'member'],
	'Expected replay to emit the same LiveEvent types as the trace',
);
if (!result.stateTransitions.includes('connected')) {
	throw new Error('Expected replay to observe the connected ConnectionState transition');
}
if (result.decodeFailures !== 1) {
	throw new Error(
		`Expected only the known malformed frame to increment decode failures, got ${result.decodeFailures}`,
	);
}
if (!result.logs.some((log) => log.message.includes('frame.decode-result'))) {
	throw new Error('Expected replay to produce decode-result diagnostic logs');
}
if (!result.logs.some((log) => log.message.includes('frame.decode-error'))) {
	throw new Error('Expected replay to produce decode-error diagnostic logs for malformed input');
}

function traceDocument(events: LiveIngestionTraceDocument['events']): LiveIngestionTraceDocument {
	return {
		schema: 'celestia-trace-v1',
		capturedAt: '2026-05-20T12:00:00.000Z',
		extension: { version: '1.0.0', build: 'illegal-v2' },
		sessionId: 'trace-replay-test',
		usernameHash: 'sha256:22222222',
		events,
	};
}

function socketCreated(elapsedMs: number, requestId: string): SocketCreatedTraceEvent {
	return {
		kind: 'socket_created',
		elapsedMs,
		requestId,
		urlOrigin: 'wss://webcast-ws.tiktok.com',
		urlPath: '/webcast/im/ws_proxy/',
		urlQueryHash: 'sha256:33333333',
		matchesLivePattern: true,
	};
}

function frame(
	label: string,
	elapsedMs: number,
	requestId: string,
	route: FrameTraceEvent['route'],
	messages?: Uint8Array[],
	syntheticPayloadBase64 = frameBase64(messages ?? []),
): FrameTraceEvent {
	const liveEventTypes = liveEventTypesFromMessages(messages ?? []);
	return {
		kind: 'frame_received',
		elapsedMs,
		requestId,
		payloadByteLength: syntheticPayloadBase64.length,
		route,
		decodeSummary: {
			outcome: messages === undefined ? 'error' : 'success',
			envelopeType: messages === undefined ? null : 'msg',
			messageCount: messages?.length ?? 0,
			messageTypes: messageTypesFromMessages(label, messages ?? []),
			liveEventCount: liveEventTypes.length,
			liveEventTypes,
			dedupSkipped: 0,
			errorMessage: messages === undefined ? 'invalid wire type' : null,
			diagnostics: [],
		},
		syntheticPayloadBase64,
	};
}

function transition(
	from: ChromeTraceStatus,
	to: ChromeTraceStatus,
	elapsedMs: number,
	decodeFailures: number,
	confirmedSocketRequestId: string | null = null,
): StateTransitionTraceEvent {
	return {
		kind: 'state_transition',
		elapsedMs,
		from,
		to,
		reason: null,
		socketCount: 0,
		eventCount: 0,
		decodeFailures,
		promiscuousMode: false,
		confirmedSocketRequestId,
		confirmedSocketUrlOrigin: null,
		confirmedSocketUrlPath: null,
	};
}

function liveEvent(
	eventType: LiveEvent['type'],
	elapsedMs: number,
	rawType: string,
): LiveEventTraceEvent {
	return {
		kind: 'live_event_emitted',
		elapsedMs,
		eventIdHash: 'sha256:44444444',
		eventType,
		rawType,
		userIdHash: 'sha256:55555555',
		viewerCount: null,
		giftId: null,
		source: 'tiktok-live-chrome-extension',
	};
}

function messageTypesFromMessages(label: string, messages: Uint8Array[]): string[] {
	if (messages.length === 0) return [];
	return label === 'rotated-live' ? ['WebcastMemberMessage'] : ['WebcastChatMessage'];
}

function liveEventTypesFromMessages(messages: Uint8Array[]): LiveEvent['type'][] {
	if (messages.length === 0) return [];
	return messages.some((message) => message.includes(52)) ? ['member'] : ['chat'];
}

function assertArray<T>(actual: T[], expected: T[], message: string): void {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);
	}
}
