import type { LiveEvent, ProviderLog } from '@celestia/tiktok-live-core';
import type {
	ChromeDebuggerTransport,
	Debuggee,
} from '../src/chrome-extension/chrome-debugger-transport.js';
import {
	type ChromeConnectionState,
	ChromeExtensionTikTokLiveProvider,
	type LiveIngestionTraceDocument,
	type LiveIngestionTraceEvent,
} from '../src/index.js';

type ReplayTraceInput = LiveIngestionTraceDocument | string;
type ReplayTimer = { handler: () => void; dueAt: number; active: boolean };

interface ReplayResult {
	events: LiveEvent[];
	liveEventTypes: LiveEvent['type'][];
	states: ChromeConnectionState[];
	stateTransitions: ChromeConnectionState['status'][];
	logs: ProviderLog[];
	decodeFailures: number;
}

export async function replayLiveIngestionTrace(input: ReplayTraceInput): Promise<ReplayResult> {
	const trace = parseTrace(input);
	const transport = new ReplayTransport();
	const timers = new ReplayTimers();
	const capturedAtMs = Date.parse(trace.capturedAt);
	let now = capturedAtMs;
	const provider = new ChromeExtensionTikTokLiveProvider({
		transport,
		browserEvents: undefined,
		now: () => now,
		setTimeout: timers.setTimeout,
		clearTimeout: timers.clearTimeout,
		diagnostics: {
			enabled: true,
		},
	});
	const events: LiveEvent[] = [];
	const states: ChromeConnectionState[] = [];
	const logs: ProviderLog[] = [];
	provider.onEvent((event) => events.push(event));
	provider.onConnectionState((state) => states.push(state as ChromeConnectionState));
	provider.onLog((log) => logs.push(log));

	const replayEvents = [...trace.events].sort((left, right) => left.elapsedMs - right.elapsedMs);
	for (const event of replayEvents) {
		now = capturedAtMs + event.elapsedMs;
		timers.runDue(event.elapsedMs);
		await replayTraceEvent(event, provider, transport);
		await flushMicrotasks();
	}
	timers.runDue(Number.POSITIVE_INFINITY);

	const result: ReplayResult = {
		events,
		liveEventTypes: events.map((event) => event.type),
		states,
		stateTransitions: transitionStatuses(states),
		logs,
		decodeFailures: provider.getConnectionState().decodeFailures,
	};
	assertReplayMatchesTrace(trace, result);
	provider.destroy();
	return result;
}

class ReplayTransport implements ChromeDebuggerTransport {
	eventHandler:
		| ((source: Debuggee, method: string, params?: Record<string, unknown>) => void)
		| undefined;
	detachHandler: ((source: Debuggee, reason: string) => void) | undefined;
	attachedTabId: number | undefined;

	async queryActiveTab(): Promise<ChromeApi.Tab> {
		return { id: this.attachedTabId ?? 1 };
	}

	async attach(debuggee: Debuggee): Promise<void> {
		this.attachedTabId = debuggee.tabId;
	}

	async detach(): Promise<void> {
		this.attachedTabId = undefined;
	}

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

	addTabUpdatedListener(): void {}

	removeTabUpdatedListener(): void {}

	emit(method: string, params?: Record<string, unknown>): void {
		if (this.attachedTabId === undefined) {
			throw new Error(`Cannot replay ${method} before debugger attachment`);
		}
		this.eventHandler?.({ tabId: this.attachedTabId }, method, params);
	}

	detachFromTrace(reason: string): void {
		if (this.attachedTabId === undefined) return;
		this.detachHandler?.({ tabId: this.attachedTabId }, reason);
	}
}

class ReplayTimers {
	private readonly timers: ReplayTimer[] = [];

	readonly setTimeout = ((handler: () => void, delay?: number) => {
		const timer = { handler, dueAt: this.now + (delay ?? 0), active: true };
		this.timers.push(timer);
		return timer as unknown as ReturnType<typeof setTimeout>;
	}) as unknown as typeof setTimeout;

	readonly clearTimeout = ((timer: ReplayTimer | undefined) => {
		if (timer !== undefined) timer.active = false;
	}) as unknown as typeof clearTimeout;

	private now = 0;

	runDue(elapsedMs: number): void {
		this.now = elapsedMs;
		for (const timer of this.timers.filter((timer) => timer.active && timer.dueAt <= elapsedMs)) {
			timer.active = false;
			timer.handler();
		}
	}
}

async function replayTraceEvent(
	event: LiveIngestionTraceEvent,
	provider: ChromeExtensionTikTokLiveProvider,
	transport: ReplayTransport,
): Promise<void> {
	switch (event.kind) {
		case 'debugger_attached':
			await provider.attach(event.tabId, 'trace-replay');
			return;
		case 'debugger_detached':
			transport.detachFromTrace(event.reason);
			return;
		case 'socket_created':
			transport.emit('Network.webSocketCreated', {
				requestId: event.requestId,
				url: reconstructSocketUrl(event),
			});
			return;
		case 'socket_handshake_request':
			transport.emit('Network.webSocketWillSendHandshakeRequest', { requestId: event.requestId });
			return;
		case 'socket_handshake_response':
			transport.emit('Network.webSocketHandshakeResponseReceived', {
				requestId: event.requestId,
				response: { status: event.statusCode },
			});
			return;
		case 'frame_received':
			if (event.syntheticPayloadBase64 === null) return;
			transport.emit('Network.webSocketFrameReceived', {
				requestId: event.requestId ?? undefined,
				response: { payloadData: event.syntheticPayloadBase64 },
			});
			return;
		default:
			return;
	}
}

function assertReplayMatchesTrace(trace: LiveIngestionTraceDocument, result: ReplayResult): void {
	const expectedEventTypes = trace.events
		.filter((event) => event.kind === 'live_event_emitted')
		.map((event) => event.eventType);
	if (JSON.stringify(result.liveEventTypes) !== JSON.stringify(expectedEventTypes)) {
		throw new Error(
			`Replay LiveEvent types diverged: expected ${JSON.stringify(expectedEventTypes)}, got ${JSON.stringify(result.liveEventTypes)}`,
		);
	}

	const expectedTransitions = trace.events
		.filter((event) => event.kind === 'state_transition')
		.map((event) => event.to);
	for (const expected of expectedTransitions) {
		if (!result.stateTransitions.includes(expected)) {
			throw new Error(`Replay did not observe expected ConnectionState transition to ${expected}`);
		}
	}

	const expectedDecodeFailures = expectedDecodeFailureCount(trace);
	if (result.decodeFailures !== expectedDecodeFailures) {
		throw new Error(
			`Replay decode failure count diverged: expected ${expectedDecodeFailures}, got ${result.decodeFailures}`,
		);
	}

	assertDiagnosticLogs(trace, result.logs);
}

function assertDiagnosticLogs(trace: LiveIngestionTraceDocument, logs: ProviderLog[]): void {
	const expectedDecodedFrames = trace.events.filter(
		(event) => event.kind === 'frame_received' && event.decodeSummary.outcome === 'success',
	).length;
	const actualDecodedFrames = logs.filter((log) =>
		log.message.includes('frame.decode-result'),
	).length;
	if (actualDecodedFrames < expectedDecodedFrames) {
		throw new Error(
			`Replay diagnostic logs missed decoded frames: expected at least ${expectedDecodedFrames}, got ${actualDecodedFrames}`,
		);
	}

	const expectedDecodeErrors = trace.events.filter(
		(event) =>
			event.kind === 'frame_received' &&
			event.decodeSummary.outcome === 'error' &&
			event.route !== 'unmapped_candidate',
	).length;
	const actualDecodeErrors = logs.filter((log) =>
		log.message.includes('frame.decode-error'),
	).length;
	if (actualDecodeErrors < expectedDecodeErrors) {
		throw new Error(
			`Replay diagnostic logs missed decode errors: expected at least ${expectedDecodeErrors}, got ${actualDecodeErrors}`,
		);
	}
}

function expectedDecodeFailureCount(trace: LiveIngestionTraceDocument): number {
	const latestStateCount =
		trace.events.filter((event) => event.kind === 'state_transition').at(-1)?.decodeFailures ?? 0;
	const knownSocketDecodeErrors = trace.events.filter(
		(event) =>
			event.kind === 'frame_received' &&
			event.decodeSummary.outcome === 'error' &&
			event.route !== 'unmapped_candidate',
	).length;
	return Math.max(latestStateCount, knownSocketDecodeErrors);
}

function parseTrace(input: ReplayTraceInput): LiveIngestionTraceDocument {
	const trace =
		typeof input === 'string' ? (JSON.parse(input) as LiveIngestionTraceDocument) : input;
	if (trace.schema !== 'celestia-trace-v1') {
		throw new Error(`Unsupported trace schema: ${trace.schema}`);
	}
	return trace;
}

function reconstructSocketUrl(
	event: Extract<LiveIngestionTraceEvent, { kind: 'socket_created' }>,
): string {
	const origin = event.urlOrigin ?? 'wss://example.invalid';
	const path = event.urlPath ?? '/';
	return `${origin}${path}`;
}

function transitionStatuses(states: ChromeConnectionState[]): ChromeConnectionState['status'][] {
	const transitions: ChromeConnectionState['status'][] = [];
	for (const state of states) {
		if (transitions.at(-1) !== state.status) transitions.push(state.status);
	}
	return transitions;
}

async function flushMicrotasks(): Promise<void> {
	for (let index = 0; index < 10; index += 1) {
		await Promise.resolve();
	}
}
