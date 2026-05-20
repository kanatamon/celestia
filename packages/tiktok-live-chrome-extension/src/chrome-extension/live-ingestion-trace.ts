import type { ConnectionState, LiveEvent } from '@celestia/tiktok-live-core';
import { gzipSync } from 'fflate';
import type { DecodeWebcastFrameDiagnostic } from '../protocol/decode-webcast-frame.js';
import type { WebcastMessage } from '../protocol/tiktok-live.generated.js';

export const liveIngestionTraceSchema = 'celestia-trace-v1';
export const liveIngestionTraceBuild = 'live-ingestion-diagnostics-v1';

type TraceRoute = 'known_live' | 'confirmed' | 'unmapped_candidate' | 'promiscuous' | 'ignored';
type DecodeOutcome = 'success' | 'error' | 'skipped';

interface CaptureFrameReceivedInput {
	requestId: string | undefined;
	payloadData: string;
	route: TraceRoute;
	outcome: DecodeOutcome;
	envelopeType?: string;
	messages?: WebcastMessage[];
	events?: LiveEvent[];
	diagnostics: DecodeWebcastFrameDiagnostic[];
	errorMessage?: string;
}

export interface LiveIngestionTraceDocument {
	schema: typeof liveIngestionTraceSchema;
	capturedAt: string;
	extension: {
		version: string;
		build: string;
	};
	sessionId: string;
	usernameHash: string | null;
	events: LiveIngestionTraceEvent[];
}

export type LiveIngestionTraceEvent =
	| { kind: 'debugger_attached'; elapsedMs: number; tabId: number; tabUrlHash: string | null }
	| {
			kind: 'debugger_detached';
			elapsedMs: number;
			tabId: number;
			reason: string;
			explicit: boolean;
	  }
	| { kind: 'network_enabled'; elapsedMs: number }
	| {
			kind: 'socket_created';
			elapsedMs: number;
			requestId: string;
			urlOrigin: string | null;
			urlPath: string | null;
			urlQueryHash: string | null;
			matchesLivePattern: boolean;
	  }
	| { kind: 'socket_handshake_request'; elapsedMs: number; requestId: string }
	| {
			kind: 'socket_handshake_response';
			elapsedMs: number;
			requestId: string;
			statusCode: number | null;
	  }
	| {
			kind: 'frame_received';
			elapsedMs: number;
			requestId: string | null;
			payloadByteLength: number;
			route: TraceRoute;
			decodeSummary: {
				outcome: DecodeOutcome;
				envelopeType: string | null;
				messageCount: number;
				messageTypes: string[];
				liveEventCount: number;
				liveEventTypes: string[];
				dedupSkipped: number;
				errorMessage: string | null;
				diagnostics: DecodeWebcastFrameDiagnostic[];
			};
			syntheticPayloadBase64: string | null;
	  }
	| {
			kind: 'state_transition';
			elapsedMs: number;
			from: ConnectionState['status'];
			to: ConnectionState['status'];
			reason: ConnectionState['reason'] | null;
			socketCount: number;
			eventCount: number;
			decodeFailures: number;
			promiscuousMode: boolean;
			confirmedSocketRequestId: string | null;
			confirmedSocketUrlOrigin: string | null;
			confirmedSocketUrlPath: string | null;
	  }
	| {
			kind: 'live_event_emitted';
			elapsedMs: number;
			eventIdHash: string;
			eventType: LiveEvent['type'];
			rawType: string;
			userIdHash: string | null;
			viewerCount: number | null;
			giftId: string | null;
			source: string;
	  }
	| {
			kind: 'live_event_emit_failed';
			elapsedMs: number;
			eventIdHash: string;
			eventType: LiveEvent['type'];
			error: string;
	  }
	| { kind: 'native_invocation_error'; elapsedMs: number; api: string; error: string }
	| { kind: 'promiscuous_mode_entered'; elapsedMs: number };

interface LiveIngestionTraceCaptureOptions {
	extensionVersion: string;
	build: string;
	now: () => number;
}

export class LiveIngestionTraceCapture {
	private readonly startedAtMs: number;
	private readonly capturedAt: string;
	private readonly sessionId = createSessionId();
	private readonly events: LiveIngestionTraceEvent[] = [];
	private readonly pending: Promise<void>[] = [];
	private usernameHash: string | null = null;

	constructor(private readonly options: LiveIngestionTraceCaptureOptions) {
		this.startedAtMs = options.now();
		this.capturedAt = new Date(this.startedAtMs).toISOString();
	}

	setUsername(username: string): void {
		this.pending.push(
			sha256Short(username).then((hash) => {
				this.usernameHash = hash;
			}),
		);
	}

	captureDebuggerAttached(tabId: number, tabUrl: string | undefined): void {
		const event: LiveIngestionTraceEvent = {
			kind: 'debugger_attached',
			elapsedMs: this.elapsedMs(),
			tabId,
			tabUrlHash: null,
		};
		this.events.push(event);
		if (tabUrl) {
			this.pending.push(
				sha256Short(tabUrl).then((hash) => {
					event.tabUrlHash = hash;
				}),
			);
		}
	}

	captureDebuggerDetached(tabId: number, reason: string, explicit: boolean): void {
		this.events.push({
			kind: 'debugger_detached',
			elapsedMs: this.elapsedMs(),
			tabId,
			reason,
			explicit,
		});
	}

	captureNetworkEnabled(): void {
		this.events.push({ kind: 'network_enabled', elapsedMs: this.elapsedMs() });
	}

	captureSocketCreated(requestId: string, url: string, liveSocketPattern: string): void {
		const parsed = sanitizeUrl(url);
		const event: LiveIngestionTraceEvent = {
			kind: 'socket_created',
			elapsedMs: this.elapsedMs(),
			requestId,
			urlOrigin: parsed?.origin ?? null,
			urlPath: parsed?.pathname ?? null,
			urlQueryHash: null,
			matchesLivePattern: url.includes(liveSocketPattern),
		};
		this.events.push(event);
		if (parsed?.search) {
			this.pending.push(
				sha256Short(parsed.search).then((hash) => {
					event.urlQueryHash = hash;
				}),
			);
		}
	}

	captureSocketHandshakeRequest(requestId: string): void {
		this.events.push({ kind: 'socket_handshake_request', elapsedMs: this.elapsedMs(), requestId });
	}

	captureSocketHandshakeResponse(requestId: string, statusCode: number | null): void {
		this.events.push({
			kind: 'socket_handshake_response',
			elapsedMs: this.elapsedMs(),
			requestId,
			statusCode,
		});
	}

	captureFrameReceived(input: CaptureFrameReceivedInput): void {
		const messages = input.messages ?? [];
		const events = input.events ?? [];
		this.events.push({
			kind: 'frame_received',
			elapsedMs: this.elapsedMs(),
			requestId: input.requestId ?? null,
			payloadByteLength: payloadByteLength(input.payloadData),
			route: input.route,
			decodeSummary: {
				outcome: input.outcome,
				envelopeType: input.envelopeType ?? null,
				messageCount: messages.length,
				messageTypes: messages.map((message) => message.type),
				liveEventCount: events.length,
				liveEventTypes: events.map((event) => event.type),
				dedupSkipped: Math.max(messages.length - events.length, 0),
				errorMessage: input.errorMessage ?? null,
				diagnostics: input.diagnostics,
			},
			syntheticPayloadBase64: syntheticPayloadForOutcome(input.outcome, messages),
		});
	}

	captureStateTransition(
		from: ConnectionState['status'],
		state: ConnectionState & {
			socketCount?: number;
			eventCount?: number;
			decodeFailures?: number;
			promiscuousMode?: boolean;
			confirmedSocketRequestId?: string;
			confirmedSocketUrl?: string;
		},
	): void {
		const confirmedUrl = state.confirmedSocketUrl
			? sanitizeUrl(state.confirmedSocketUrl)
			: undefined;
		this.events.push({
			kind: 'state_transition',
			elapsedMs: this.elapsedMs(),
			from,
			to: state.status,
			reason: state.reason ?? null,
			socketCount: state.socketCount ?? 0,
			eventCount: state.eventCount ?? 0,
			decodeFailures: state.decodeFailures ?? 0,
			promiscuousMode: state.promiscuousMode ?? false,
			confirmedSocketRequestId: state.confirmedSocketRequestId ?? null,
			confirmedSocketUrlOrigin: confirmedUrl?.origin ?? null,
			confirmedSocketUrlPath: confirmedUrl?.pathname ?? null,
		});
	}

	captureLiveEvent(event: LiveEvent): void {
		const traceEvent: Extract<LiveIngestionTraceEvent, { kind: 'live_event_emitted' }> = {
			kind: 'live_event_emitted',
			elapsedMs: this.elapsedMs(),
			eventIdHash: '',
			eventType: event.type,
			rawType: event.rawType ?? event.type,
			userIdHash: null,
			viewerCount: event.type === 'viewer_count' ? event.viewerCount : null,
			giftId: event.type === 'gift' ? (event.giftId ?? null) : null,
			source: event.source,
		};
		this.events.push(traceEvent);
		this.captureEventIdHash(event.id, traceEvent);
		const userId = 'user' in event ? event.user?.userId : undefined;
		if (userId !== undefined) {
			this.pending.push(
				sha256Short(userId).then((hash) => {
					traceEvent.userIdHash = hash;
				}),
			);
		}
	}

	captureLiveEventEmitFailed(event: LiveEvent, error: string): void {
		const traceEvent: Extract<LiveIngestionTraceEvent, { kind: 'live_event_emit_failed' }> = {
			kind: 'live_event_emit_failed',
			elapsedMs: this.elapsedMs(),
			eventIdHash: '',
			eventType: event.type,
			error,
		};
		this.events.push(traceEvent);
		this.captureEventIdHash(event.id, traceEvent);
	}

	captureNativeInvocationError(api: string, error: string): void {
		this.events.push({ kind: 'native_invocation_error', elapsedMs: this.elapsedMs(), api, error });
	}

	capturePromiscuousModeEntered(): void {
		this.events.push({ kind: 'promiscuous_mode_entered', elapsedMs: this.elapsedMs() });
	}

	async exportJson(): Promise<string> {
		await Promise.all(this.pending);
		const document: LiveIngestionTraceDocument = {
			schema: liveIngestionTraceSchema,
			capturedAt: this.capturedAt,
			extension: {
				version: this.options.extensionVersion,
				build: this.options.build,
			},
			sessionId: this.sessionId,
			usernameHash: this.usernameHash,
			events: this.events,
		};
		return JSON.stringify(document, null, 2);
	}

	private captureEventIdHash(eventId: string, traceEvent: { eventIdHash: string }): void {
		this.pending.push(
			sha256Short(eventId).then((hash) => {
				traceEvent.eventIdHash = hash;
			}),
		);
	}

	private elapsedMs(): number {
		return Math.max(0, Math.round(this.options.now() - this.startedAtMs));
	}
}

function syntheticPayloadForOutcome(
	outcome: DecodeOutcome,
	messages: WebcastMessage[],
): string | null {
	switch (outcome) {
		case 'success':
			return syntheticPayloadBase64(messages);
		case 'error':
			return 'AA==';
		case 'skipped':
			return null;
	}
}

function syntheticPayloadBase64(messages: WebcastMessage[]): string {
	const response = encodeFields(messages.map((message) => bytesField(1, encodeMessage(message))));
	const envelope = encodeFields([
		uintField(2, 1),
		stringField(7, 'msg'),
		bytesField(8, gzipSync(response)),
	]);
	return bytesToBase64(envelope);
}

function encodeMessage(message: WebcastMessage): Uint8Array {
	return encodeFields([
		stringField(1, message.type),
		bytesField(2, sanitizedMessageBinary(message)),
	]);
}

function sanitizedMessageBinary(message: WebcastMessage): Uint8Array {
	const hash = fnv32Hex(message.binary);
	return encodeFields([bytesField(1, encodeFields([stringField(2, hash)]))]);
}

function payloadByteLength(payloadData: string): number {
	if (typeof globalThis.atob === 'function') return globalThis.atob(payloadData).length;
	return Buffer.from(payloadData, 'base64').length;
}

function sanitizeUrl(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

async function sha256Short(value: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle;
	if (subtle === undefined) throw new Error('crypto.subtle is required for trace hashing');
	const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
	const bytes = Array.from(new Uint8Array(digest).slice(0, 4));
	return `sha256:${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function createSessionId(): string {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	return `trace-${Math.random().toString(36).slice(2)}`;
}

function encodeFields(fields: Uint8Array[]): Uint8Array {
	const length = fields.reduce((total, field) => total + field.length, 0);
	const output = new Uint8Array(length);
	let offset = 0;
	for (const field of fields) {
		output.set(field, offset);
		offset += field.length;
	}
	return output;
}

function uintField(fieldNumber: number, value: number): Uint8Array {
	return encodeFields([varint((fieldNumber << 3) | 0), varint(value)]);
}

function stringField(fieldNumber: number, value: string): Uint8Array {
	return bytesField(fieldNumber, new TextEncoder().encode(value));
}

function bytesField(fieldNumber: number, value: Uint8Array): Uint8Array {
	return encodeFields([varint((fieldNumber << 3) | 2), varint(value.length), value]);
}

function varint(value: number): Uint8Array {
	const bytes: number[] = [];
	let current = value;
	while (current >= 0x80) {
		bytes.push((current & 0x7f) | 0x80);
		current >>>= 7;
	}
	bytes.push(current);
	return new Uint8Array(bytes);
}

function fnv32Hex(bytes: Uint8Array): string {
	let hash = 0x811c9dc5;
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

function bytesToBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return globalThis.btoa(binary);
}
