import type { LiveEvent } from '@celestia/tiktok-live-core';
import type { LiveIngestionTraceDocument } from '../src/index.js';
import { bytes, event, frameBase64, msg, responseMessage, str, uint } from './protobuf-fixtures.js';

type TraceEvent = LiveIngestionTraceDocument['events'][number];
type FrameTraceEvent = Extract<TraceEvent, { kind: 'frame_received' }>;
type LiveEventTraceEvent = Extract<TraceEvent, { kind: 'live_event_emitted' }>;
type SocketCreatedTraceEvent = Extract<TraceEvent, { kind: 'socket_created' }>;
type StateTransitionTraceEvent = Extract<TraceEvent, { kind: 'state_transition' }>;
type ChromeTraceStatus = StateTransitionTraceEvent['to'];
type SyntheticLiveMessage = {
	rawType: string;
	liveEventType: LiveEvent['type'];
	binary: Uint8Array;
};

export interface GoldenLiveIngestionReplayFixture {
	name: string;
	description: string;
	trace: LiveIngestionTraceDocument;
	expectedLiveEventTypes: LiveEvent['type'][];
	expectedStateTransitions: ChromeTraceStatus[];
	expectedDecodeFailures: number;
}

export const goldenLiveIngestionReplayFixtures: GoldenLiveIngestionReplayFixture[] = [
	{
		name: 'attach-after-live-socket-opened',
		description:
			'A valid unmapped frame after debugger attach proves the already-open Live socket.',
		trace: traceDocument('golden-attach-after-open', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			frame(10, 'socket-before-attach', 'unmapped_candidate', [chatMessage(310)]),
			transition('attached', 'connected', 11, 0, 'socket-before-attach'),
			liveEvent('chat', 11, 'WebcastChatMessage'),
		]),
		expectedLiveEventTypes: ['chat'],
		expectedStateTransitions: ['attaching', 'attached', 'connected'],
		expectedDecodeFailures: 0,
	},
	{
		name: 'unmapped-valid-live-frame',
		description: 'Promiscuous unmapped Live payloads emit LiveEvents instead of being dropped.',
		trace: traceDocument('golden-unmapped-valid-live-frame', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			frame(20, 'unmapped-live', 'unmapped_candidate', [memberMessage(311)]),
			transition('attached', 'connected', 21, 0, 'unmapped-live'),
			liveEvent('member', 21, 'WebcastMemberMessage'),
		]),
		expectedLiveEventTypes: ['member'],
		expectedStateTransitions: ['attaching', 'attached', 'connected'],
		expectedDecodeFailures: 0,
	},
	{
		name: 'empty-frame-does-not-connect',
		description: 'An empty decoded Live socket frame does not mark the Provider connected.',
		trace: traceDocument('golden-empty-frame-does-not-connect', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			socketCreated(10, 'empty-live-socket'),
			frame(11, 'empty-live-socket', 'known_live', []),
			transition('attached', 'attached', 12, 0),
		]),
		expectedLiveEventTypes: [],
		expectedStateTransitions: ['attaching', 'attached'],
		expectedDecodeFailures: 0,
	},
	{
		name: 'same-url-new-request-id',
		description: 'A reused Live WebSocket URL with a new request ID continues emitting LiveEvents.',
		trace: traceDocument('golden-same-url-new-request-id', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			socketCreated(10, 'live-socket-1'),
			frame(11, 'live-socket-1', 'known_live', [chatMessage(312)]),
			transition('attached', 'connected', 12, 0, 'live-socket-1'),
			liveEvent('chat', 12, 'WebcastChatMessage'),
			socketCreated(20, 'live-socket-2'),
			frame(21, 'live-socket-2', 'known_live', [chatMessage(313)]),
			transition('connected', 'connected', 22, 0, 'live-socket-2'),
			liveEvent('chat', 22, 'WebcastChatMessage'),
		]),
		expectedLiveEventTypes: ['chat', 'chat'],
		expectedStateTransitions: ['attaching', 'attached', 'connected'],
		expectedDecodeFailures: 0,
	},
	{
		name: 'native-timer-browser-invocation',
		description:
			'LiveEvent replay schedules Provider timers without surfacing browser invocation errors.',
		trace: traceDocument('golden-native-timer-browser-invocation', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			socketCreated(10, 'timer-live-socket'),
			frame(11, 'timer-live-socket', 'known_live', [chatMessage(314)]),
			transition('attached', 'connected', 12, 0, 'timer-live-socket'),
			liveEvent('chat', 12, 'WebcastChatMessage'),
		]),
		expectedLiveEventTypes: ['chat'],
		expectedStateTransitions: ['attaching', 'attached', 'connected'],
		expectedDecodeFailures: 0,
	},
	{
		name: 'malformed-unmapped-frame-is-non-fatal',
		description:
			'Malformed unmapped traffic does not prove a Live socket or increment decode failures.',
		trace: traceDocument('golden-malformed-unmapped-frame-is-non-fatal', [
			baseAttach(0),
			transition('idle', 'attaching', 0, 0),
			transition('attaching', 'attached', 1, 0),
			malformedFrame(10, 'unmapped-noise', 'unmapped_candidate', 'AA=='),
			transition('attached', 'attached', 11, 0),
			socketCreated(20, 'live-socket-after-noise'),
			frame(21, 'live-socket-after-noise', 'known_live', [chatMessage(315)]),
			transition('attached', 'connected', 22, 0, 'live-socket-after-noise'),
			liveEvent('chat', 22, 'WebcastChatMessage'),
		]),
		expectedLiveEventTypes: ['chat'],
		expectedStateTransitions: ['attaching', 'attached', 'connected'],
		expectedDecodeFailures: 0,
	},
];

function traceDocument(
	sessionId: string,
	events: LiveIngestionTraceDocument['events'],
): LiveIngestionTraceDocument {
	return {
		schema: 'celestia-trace-v1',
		capturedAt: '2026-05-20T12:00:00.000Z',
		extension: { version: '1.0.0', build: 'live-ingestion-diagnostics-v1' },
		sessionId,
		usernameHash: 'sha256:22222222',
		events,
	};
}

function baseAttach(elapsedMs: number): TraceEvent {
	return {
		kind: 'debugger_attached',
		elapsedMs,
		tabId: 42,
		tabUrlHash: 'sha256:11111111',
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
	elapsedMs: number,
	requestId: string,
	route: FrameTraceEvent['route'],
	messages: SyntheticLiveMessage[],
	syntheticPayloadBase64 = frameBase64(messages.map((message) => message.binary)),
): FrameTraceEvent {
	return {
		kind: 'frame_received',
		elapsedMs,
		requestId,
		payloadByteLength: syntheticPayloadBase64.length,
		route,
		decodeSummary: {
			outcome: 'success',
			envelopeType: 'msg',
			messageCount: messages.length,
			messageTypes: messages.map((message) => message.rawType),
			liveEventCount: messages.length,
			liveEventTypes: messages.map((message) => message.liveEventType),
			dedupSkipped: 0,
			errorMessage: null,
			diagnostics: [],
		},
		syntheticPayloadBase64,
	};
}

function malformedFrame(
	elapsedMs: number,
	requestId: string,
	route: FrameTraceEvent['route'],
	syntheticPayloadBase64: string,
): FrameTraceEvent {
	return {
		kind: 'frame_received',
		elapsedMs,
		requestId,
		payloadByteLength: syntheticPayloadBase64.length,
		route,
		decodeSummary: {
			outcome: 'error',
			envelopeType: null,
			messageCount: 0,
			messageTypes: [],
			liveEventCount: 0,
			liveEventTypes: [],
			dedupSkipped: 0,
			errorMessage: 'invalid wire type',
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

function chatMessage(msgId: number): SyntheticLiveMessage {
	return {
		rawType: 'WebcastChatMessage',
		liveEventType: 'chat',
		binary: responseMessage('WebcastChatMessage', msg([bytes(1, event(msgId)), str(3, '')])),
	};
}

function memberMessage(msgId: number): SyntheticLiveMessage {
	return {
		rawType: 'WebcastMemberMessage',
		liveEventType: 'member',
		binary: responseMessage('WebcastMemberMessage', msg([bytes(1, event(msgId)), uint(10, 52)])),
	};
}
