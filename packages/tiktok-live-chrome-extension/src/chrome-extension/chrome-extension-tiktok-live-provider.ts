import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
} from '@celestia/tiktok-live-core';
import { classifyConnectionState } from '../connection-classifier.js';
import {
	type DecodeWebcastFrameDiagnostic,
	DedupWindow,
	decodeWebcastFrame,
} from '../protocol/decode-webcast-frame.js';
import type { ChromeConnectionState } from '../types/chrome-connection-state.js';
import {
	ChromeApiDebuggerTransport,
	type ChromeDebuggerTransport,
	type Debuggee,
} from './chrome-debugger-transport.js';
import { LiveIngestionTraceCapture, liveIngestionTraceBuild } from './live-ingestion-trace.js';

const liveSocketPattern = 'webcast-ws.tiktok.com/webcast/im/ws_proxy/';
const promiscuousModeDelayMs = 10_000;
const defaultStaleEventThresholdMs = 20_000;
const diagnosticLogPrefix = '[DEBUG-illegal-v2]';
const socketTrackingMethods = new Set([
	'Network.webSocketCreated',
	'Network.webSocketWillSendHandshakeRequest',
	'Network.webSocketHandshakeResponseReceived',
]);

interface BrowserEventTarget {
	readonly online?: boolean;
	addEventListener(type: 'online' | 'offline', handler: () => void): void;
	removeEventListener(type: 'online' | 'offline', handler: () => void): void;
}

export interface ChromeExtensionTikTokLiveProviderOptions {
	transport?: ChromeDebuggerTransport;
	browserEvents?: BrowserEventTarget;
	now?: () => number;
	setTimeout?: typeof globalThis.setTimeout;
	clearTimeout?: typeof globalThis.clearTimeout;
	staleEventThresholdMs?: number;
	trace?: {
		enabled: boolean;
		extensionVersion?: string;
	};
}

export class ChromeExtensionTikTokLiveProvider implements TikTokLiveProvider {
	private state: ChromeConnectionState = emptyState('idle');
	private readonly eventHandlers = new Set<(event: LiveEvent) => void>();
	private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
	private readonly logHandlers = new Set<(log: ProviderLog) => void>();
	private readonly sockets = new Map<string, string>();
	private readonly dedupWindow = new DedupWindow();
	private readonly transport: ChromeDebuggerTransport;
	private readonly browserEvents: BrowserEventTarget | undefined;
	private readonly now: () => number;
	private readonly setTimer: typeof globalThis.setTimeout;
	private readonly clearTimer: typeof globalThis.clearTimeout;
	private readonly staleEventThresholdMs: number;
	private promiscuousTimer: ReturnType<typeof setTimeout> | undefined;
	private staleEventTimer: ReturnType<typeof setTimeout> | undefined;
	private explicitDetachInProgress = false;
	private debuggerAttached = false;
	private streamEnded = false;
	private destroyed = false;
	private readonly traceCapture: LiveIngestionTraceCapture | undefined;

	private readonly handleDebuggerEvent = (
		source: Debuggee,
		method: string,
		params?: Record<string, unknown>,
	): void => {
		if (!this.isActiveDebuggee(source)) return;
		this.handleNetworkEvent(method, params ?? {});
	};

	private readonly handleDebuggerDetach = (source: Debuggee, reason: string): void => {
		if (!this.isActiveDebuggee(source)) return;
		if (source.tabId !== undefined) {
			this.traceCapture?.captureDebuggerDetached(
				source.tabId,
				reason,
				this.explicitDetachInProgress,
			);
		}
		this.clearPromiscuousTimer();
		this.clearStaleEventTimer();
		this.debuggerAttached = false;
		if (this.explicitDetachInProgress) {
			this.setState({ ...this.state, status: 'detached', tabId: undefined, attachedAt: undefined });
		} else {
			this.applyClassifiedState();
		}
		this.emitLog('warn', 'Chrome debugger detached', { reason });
	};

	private readonly handleBrowserOffline = (): void => {
		this.clearStaleEventTimer();
		this.applyClassifiedState(false);
	};

	private readonly handleBrowserOnline = (): void => {
		if (this.state.tabId === undefined || this.streamEnded) return;
		const { tabId, username, tabUrl } = this.state;
		this.emitLog('info', 'Browser online; reattaching confirmed TikTok Live target', {
			tabId,
			username,
			tabUrl,
		});
		void this.attachToTab(tabId, username, tabUrl);
	};

	constructor(options: ChromeExtensionTikTokLiveProviderOptions = {}) {
		this.transport = options.transport ?? new ChromeApiDebuggerTransport();
		this.browserEvents = options.browserEvents ?? defaultBrowserEventTarget();
		this.now = options.now ?? Date.now;
		this.setTimer = options.setTimeout ?? globalThis.setTimeout.bind(globalThis);
		this.clearTimer = options.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
		this.staleEventThresholdMs = options.staleEventThresholdMs ?? defaultStaleEventThresholdMs;
		this.traceCapture = options.trace?.enabled
			? new LiveIngestionTraceCapture({
					extensionVersion: options.trace.extensionVersion ?? '0.0.0',
					build: liveIngestionTraceBuild,
					now: this.now,
				})
			: undefined;
		this.transport.addEventListener(this.handleDebuggerEvent);
		this.transport.addDetachListener(this.handleDebuggerDetach);
		this.browserEvents?.addEventListener('offline', this.handleBrowserOffline);
		this.browserEvents?.addEventListener('online', this.handleBrowserOnline);
		this.emitLog('debug', 'Chrome Extension Provider constructed');
		this.emitLog('debug', `${diagnosticLogPrefix} provider.marker`, {
			version: 'illegal-v2',
		});
	}

	async connect(username: string): Promise<ConnectionState> {
		return this.attachActiveTab(username);
	}

	async disconnect(): Promise<ConnectionState> {
		return this.detach();
	}

	async attachActiveTab(username = ''): Promise<ChromeConnectionState> {
		this.assertUsable();
		this.emitLog('info', 'Querying active tab for debugger attach');
		const tab = await this.transport.queryActiveTab();
		this.emitLog('info', 'Active tab query result', {
			tabId: tab?.id,
			url: tab?.url,
		});
		if (tab?.id === undefined) {
			return this.fail(new Error('No active tab with an ID is available'));
		}

		return this.attachToTab(tab.id, username, tab.url);
	}

	async attach(tabId: number, username = '', tabUrl?: string): Promise<ChromeConnectionState> {
		return this.attachToTab(tabId, username, tabUrl);
	}

	private async attachToTab(
		tabId: number,
		username: string,
		tabUrl?: string,
	): Promise<ChromeConnectionState> {
		this.assertUsable();
		if (this.state.tabId !== undefined) {
			await this.detach();
		}

		this.clearDiscoveryState();
		this.debuggerAttached = false;
		this.streamEnded = false;
		const debuggee = { tabId };
		this.setState({
			...this.state,
			status: 'attaching',
			tabId,
			tabUrl,
			username,
		});

		try {
			this.emitLog('info', 'Attaching Chrome debugger', debuggee);
			await this.transport.attach(debuggee);
			this.debuggerAttached = true;
			this.traceCapture?.setUsername(username);
			this.traceCapture?.captureDebuggerAttached(tabId, tabUrl);
			this.emitLog('info', 'Enabling Chrome debugger Network domain', debuggee);
			await this.transport.enableNetwork(debuggee);
			this.traceCapture?.captureNetworkEnabled();
			this.setState({
				...this.state,
				status: 'attached',
				username,
				reason: undefined,
				attachedAt: this.now(),
				socketCount: 0,
				confirmedSocketRequestId: undefined,
				confirmedSocketUrl: undefined,
				lastDecodedEventAt: undefined,
				promiscuousMode: false,
			});
			this.schedulePromiscuousMode();
			return this.state;
		} catch (error) {
			return this.fail(error);
		}
	}

	async detach(): Promise<ChromeConnectionState> {
		this.assertUsable();
		if (this.state.tabId === undefined) {
			this.setState({ ...this.state, status: 'idle' });
			return this.state;
		}

		const debuggee = { tabId: this.state.tabId };
		this.setState({ ...this.state, status: 'detaching' });
		try {
			this.explicitDetachInProgress = true;
			await this.transport.detach(debuggee);
			this.debuggerAttached = false;
			this.clearPromiscuousTimer();
			this.clearStaleEventTimer();
			this.sockets.clear();
			this.setState({
				...emptyState('detached'),
				tabUrl: this.state.tabUrl,
				eventCount: this.state.eventCount,
				decodeFailures: this.state.decodeFailures,
			});
			return this.state;
		} catch (error) {
			return this.fail(error);
		} finally {
			this.explicitDetachInProgress = false;
		}
	}

	getConnectionState(): ChromeConnectionState {
		return this.state;
	}

	onEvent(handler: (event: LiveEvent) => void): Unsubscribe {
		this.eventHandlers.add(handler);
		return () => this.eventHandlers.delete(handler);
	}

	onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe {
		this.stateHandlers.add(handler);
		handler(this.state);
		return () => this.stateHandlers.delete(handler);
	}

	onLog(handler: (log: ProviderLog) => void): Unsubscribe {
		this.logHandlers.add(handler);
		this.emitLog('debug', `${diagnosticLogPrefix} provider.marker`, {
			version: 'illegal-v2',
		});
		return () => this.logHandlers.delete(handler);
	}

	async exportTraceJson(): Promise<string | undefined> {
		return this.traceCapture?.exportJson();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.transport.removeEventListener(this.handleDebuggerEvent);
		this.transport.removeDetachListener(this.handleDebuggerDetach);
		this.browserEvents?.removeEventListener('offline', this.handleBrowserOffline);
		this.browserEvents?.removeEventListener('online', this.handleBrowserOnline);
		this.clearPromiscuousTimer();
		this.clearStaleEventTimer();
		if (this.state.tabId !== undefined) {
			void this.transport.detach({ tabId: this.state.tabId }).catch((error: unknown) => {
				this.emitLog('warn', 'Failed to detach Chrome debugger during destroy', {
					error: errorMessage(error),
				});
			});
		}
		this.sockets.clear();
		this.eventHandlers.clear();
		this.stateHandlers.clear();
		this.logHandlers.clear();
		this.state = emptyState('detached');
	}

	private handleNetworkEvent(method: string, params: Record<string, unknown>): void {
		if (socketTrackingMethods.has(method)) {
			this.trackSocket(method, params);
			return;
		}

		if (method !== 'Network.webSocketFrameReceived') return;
		const requestId = stringParam(params, 'requestId');
		const url = requestId === undefined ? undefined : this.sockets.get(requestId);
		const shouldDecodeKnownSocket = this.shouldDecodeSocket(requestId, url);
		const shouldDecodeUnmappedCandidate =
			!shouldDecodeKnownSocket && this.shouldDecodeUnmappedCandidate(requestId, url);
		this.emitLog('debug', `${diagnosticLogPrefix} frame.route`, {
			requestId,
			url,
			hasTrackedUrl: url !== undefined,
			shouldDecodeKnownSocket,
			shouldDecodeUnmappedCandidate,
			confirmedSocketRequestId: this.state.confirmedSocketRequestId,
			confirmedSocketUrl: this.state.confirmedSocketUrl,
			promiscuousMode: this.state.promiscuousMode,
			status: this.state.status,
		});
		const route = routeForTrace({
			shouldDecodeKnownSocket,
			shouldDecodeUnmappedCandidate,
			confirmed: this.isConfirmedSocket(requestId, url),
			promiscuous: this.state.promiscuousMode,
			url,
		});
		if (!shouldDecodeKnownSocket && !shouldDecodeUnmappedCandidate) {
			const ignoredPayloadData = isRecord(params.response)
				? stringParam(params.response, 'payloadData')
				: undefined;
			if (ignoredPayloadData !== undefined) {
				this.traceCapture?.captureFrameReceived({
					requestId,
					payloadData: ignoredPayloadData,
					route: 'ignored',
					outcome: 'skipped',
					diagnostics: [],
				});
			}
			this.emitLog('debug', 'Ignoring WebSocket frame from unconfirmed socket', {
				requestId,
				url,
				promiscuousMode: this.state.promiscuousMode,
			});
			return;
		}
		const response = params.response;
		if (!isRecord(response)) return;
		const payloadData = stringParam(response, 'payloadData');
		if (payloadData === undefined) return;

		const diagnostics: DecodeWebcastFrameDiagnostic[] = [];
		let result: ReturnType<typeof decodeWebcastFrame>;
		try {
			result = decodeWebcastFrame(payloadData, this.dedupWindow, {
				onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
			});
			this.traceCapture?.captureFrameReceived({
				requestId,
				payloadData,
				route,
				outcome: result.skipped ? 'skipped' : 'success',
				envelopeType: result.envelopeType,
				messages: result.messages,
				events: result.events,
				diagnostics,
			});
			this.emitLog('debug', `${diagnosticLogPrefix} frame.decode-result`, {
				requestId,
				url,
				skipped: result.skipped,
				envelopeType: result.envelopeType,
				eventCount: result.events.length,
				eventTypes: result.events.map((event) => event.type),
				diagnostics,
			});
			if (result.skipped) {
				this.emitLog('debug', 'Skipped WebSocket frame envelope', {
					requestId,
					url,
					envelopeType: result.envelopeType,
				});
				return;
			}
			this.emitLog('debug', 'Decoded WebSocket frame', {
				requestId,
				url,
				eventCount: result.events.length,
			});
		} catch (error) {
			this.traceCapture?.captureFrameReceived({
				requestId,
				payloadData,
				route,
				outcome: 'error',
				diagnostics,
				errorMessage: errorMessage(error),
			});
			this.emitLog('debug', `${diagnosticLogPrefix} frame.decode-error`, {
				requestId,
				url,
				shouldDecodeKnownSocket,
				shouldDecodeUnmappedCandidate,
				error: errorMessage(error),
				stack: errorStack(error),
				diagnostics,
			});
			if (shouldDecodeUnmappedCandidate) {
				this.emitLog('debug', 'Ignored unmapped WebSocket frame candidate', {
					requestId,
					error: errorMessage(error),
				});
				return;
			}
			this.setState({ ...this.state, decodeFailures: this.state.decodeFailures + 1 });
			this.emitLog('debug', 'Failed to decode WebSocket frame', {
				requestId,
				url,
				error: errorMessage(error),
			});
			return;
		}

		if (result.events.length === 0) return;
		this.confirmDecodedSocket(requestId, url);
		for (const event of result.events) {
			try {
				this.emitEvent(event);
			} catch (error) {
				this.emitLog('debug', 'Failed to emit decoded LiveEvent', {
					requestId,
					url,
					eventId: event.id,
					eventType: event.type,
					error: errorMessage(error),
					stack: errorStack(error),
				});
			}
		}
	}

	private trackSocket(method: string, params: Record<string, unknown>): void {
		const requestId = stringParam(params, 'requestId');
		const url = stringParam(params, 'url') ?? nestedStringParam(params, 'request', 'url');
		if (requestId === undefined) return;
		if (method === 'Network.webSocketWillSendHandshakeRequest') {
			this.traceCapture?.captureSocketHandshakeRequest(requestId);
		}
		if (method === 'Network.webSocketHandshakeResponseReceived') {
			this.traceCapture?.captureSocketHandshakeResponse(requestId, handshakeStatusCode(params));
		}
		if (url === undefined) return;
		this.sockets.set(requestId, url);
		if (method === 'Network.webSocketCreated') {
			this.traceCapture?.captureSocketCreated(requestId, url, liveSocketPattern);
		}
		this.emitLog(url.includes(liveSocketPattern) ? 'info' : 'debug', 'Tracked WebSocket', {
			requestId,
			url,
			socketCount: this.sockets.size,
			matchesLiveSocketPattern: url.includes(liveSocketPattern),
		});
		this.setState({ ...this.state, socketCount: this.sockets.size });
	}

	private shouldDecodeSocket(requestId: string | undefined, url: string | undefined): boolean {
		if (this.isConfirmedSocket(requestId, url)) return true;
		if (url?.includes(liveSocketPattern)) return true;
		return this.state.promiscuousMode;
	}

	private shouldDecodeUnmappedCandidate(
		requestId: string | undefined,
		url: string | undefined,
	): boolean {
		return requestId !== undefined && url === undefined;
	}

	private isConfirmedSocket(requestId: string | undefined, url: string | undefined): boolean {
		return (
			this.state.confirmedSocketRequestId !== undefined &&
			requestId === this.state.confirmedSocketRequestId &&
			(this.state.confirmedSocketUrl === undefined || url === this.state.confirmedSocketUrl)
		);
	}

	private confirmDecodedSocket(requestId: string | undefined, url: string | undefined): void {
		if (requestId === undefined) return;
		if (this.isConfirmedSocket(requestId, url)) return;
		this.clearPromiscuousTimer();
		this.emitLog('info', 'Confirmed TikTok Live WebSocket', { requestId, url });
		this.setState({
			...this.state,
			confirmedSocketRequestId: requestId,
			confirmedSocketUrl: url,
			promiscuousMode: false,
			reason: undefined,
		});
	}

	private clearDiscoveryState(): void {
		this.clearPromiscuousTimer();
		this.sockets.clear();
		this.setState({
			...this.state,
			socketCount: 0,
			confirmedSocketRequestId: undefined,
			confirmedSocketUrl: undefined,
			lastDecodedEventAt: undefined,
			promiscuousMode: false,
		});
		this.streamEnded = false;
		this.clearStaleEventTimer();
	}

	private schedulePromiscuousMode(): void {
		this.clearPromiscuousTimer();
		this.promiscuousTimer = this.setTimer(() => {
			if (this.state.status === 'attached' && this.state.confirmedSocketUrl === undefined) {
				this.traceCapture?.capturePromiscuousModeEntered();
				this.setState({ ...this.state, promiscuousMode: true });
				this.emitLog('info', 'Entering promiscuous WebSocket decode mode');
			}
		}, promiscuousModeDelayMs);
	}

	private clearPromiscuousTimer(): void {
		if (this.promiscuousTimer === undefined) return;
		this.clearTimer(this.promiscuousTimer);
		this.promiscuousTimer = undefined;
	}

	private emitEvent(event: LiveEvent): void {
		const lastDecodedEventAt = this.now();
		const streamEnded = event.type === 'stream_end';
		if (streamEnded) this.streamEnded = true;
		this.setState({
			...this.state,
			eventCount: this.state.eventCount + 1,
			lastDecodedEventAt,
		});
		this.applyClassifiedState();
		if (streamEnded) {
			this.clearStaleEventTimer();
		} else {
			this.scheduleStaleEventTimer();
		}
		this.emitLog('debug', 'Emitting LiveEvent', {
			id: event.id,
			type: event.type,
			totalEventCount: this.state.eventCount,
		});
		this.traceCapture?.captureLiveEvent(event);
		for (const handler of this.eventHandlers) handler(event);
	}

	private applyClassifiedState(online = this.isBrowserOnline()): void {
		const classifiedState = classifyConnectionState({
			online,
			debuggerAttached: this.debuggerAttached,
			confirmedSocket: this.state.confirmedSocketRequestId !== undefined,
			lastEventAt: this.state.lastDecodedEventAt,
			staleThresholdMs: this.staleEventThresholdMs,
			streamEnded: this.streamEnded,
			now: this.now(),
			username: this.state.username,
			viewerCount: this.state.viewerCount,
		});
		this.setState({
			...this.state,
			status: classifiedState.status,
			reason: classifiedState.reason,
		});
	}

	private scheduleStaleEventTimer(): void {
		this.clearStaleEventTimer();
		this.staleEventTimer = this.setTimer(() => {
			this.staleEventTimer = undefined;
			this.applyClassifiedState();
		}, this.staleEventThresholdMs);
	}

	private clearStaleEventTimer(): void {
		if (this.staleEventTimer === undefined) return;
		this.clearTimer(this.staleEventTimer);
		this.staleEventTimer = undefined;
	}

	private setState(state: ChromeConnectionState): void {
		if (state.status !== this.state.status) {
			this.traceCapture?.captureStateTransition(this.state.status, state);
			this.emitLog('info', 'Connection state changed', {
				from: this.state.status,
				to: state.status,
				tabId: state.tabId,
				socketCount: state.socketCount,
				eventCount: state.eventCount,
				reason: state.reason,
				lastDecodedEventAt: state.lastDecodedEventAt,
				decodeFailures: state.decodeFailures,
				promiscuousMode: state.promiscuousMode,
			});
		}
		this.state = state;
		for (const handler of this.stateHandlers) handler(state);
	}

	private emitLog(
		level: ProviderLog['level'],
		message: string,
		details?: Record<string, unknown>,
	): void {
		const log: ProviderLog = {
			id: `log_${this.now()}_${Math.random().toString(36).slice(2)}`,
			ts: this.now(),
			level,
			message,
			details,
		};
		for (const handler of this.logHandlers) handler(log);
	}

	private fail(error: unknown): ChromeConnectionState {
		this.clearPromiscuousTimer();
		this.clearStaleEventTimer();
		this.emitLog('error', 'Chrome Extension Provider failed', { error: errorMessage(error) });
		this.setState({ ...this.state, status: 'error', reason: 'interrupted' });
		return this.state;
	}

	private isBrowserOnline(): boolean {
		return this.browserEvents?.online ?? true;
	}

	private isActiveDebuggee(source: Debuggee): boolean {
		return source.tabId !== undefined && source.tabId === this.state.tabId;
	}

	private assertUsable(): void {
		if (this.destroyed) {
			throw new Error('Chrome Extension Provider has been destroyed');
		}
	}
}

export function createChromeExtensionTikTokLiveProvider(
	options?: ChromeExtensionTikTokLiveProviderOptions,
): ChromeExtensionTikTokLiveProvider {
	return new ChromeExtensionTikTokLiveProvider(options);
}

function emptyState(status: ChromeConnectionState['status']): ChromeConnectionState {
	return {
		status,
		username: '',
		socketCount: 0,
		eventCount: 0,
		decodeFailures: 0,
		promiscuousMode: false,
	};
}

function defaultBrowserEventTarget(): BrowserEventTarget | undefined {
	const maybeGlobal = globalThis as Partial<BrowserEventTarget>;
	if (
		typeof maybeGlobal.addEventListener === 'function' &&
		typeof maybeGlobal.removeEventListener === 'function'
	) {
		const maybeNavigator = globalThis as { navigator?: { onLine?: boolean } };
		return {
			get online() {
				return maybeNavigator.navigator?.onLine;
			},
			addEventListener: maybeGlobal.addEventListener.bind(globalThis),
			removeEventListener: maybeGlobal.removeEventListener.bind(globalThis),
		};
	}
	return undefined;
}

function stringParam(params: Record<string, unknown>, key: string): string | undefined {
	const value = params[key];
	return typeof value === 'string' ? value : undefined;
}

function nestedStringParam(
	params: Record<string, unknown>,
	containerKey: string,
	key: string,
): string | undefined {
	const container = params[containerKey];
	return isRecord(container) ? stringParam(container, key) : undefined;
}

function handshakeStatusCode(params: Record<string, unknown>): number | null {
	const response = params.response;
	if (!isRecord(response)) return null;
	const status = response.status;
	return typeof status === 'number' ? status : null;
}

function routeForTrace({
	shouldDecodeKnownSocket,
	shouldDecodeUnmappedCandidate,
	confirmed,
	promiscuous,
	url,
}: {
	shouldDecodeKnownSocket: boolean;
	shouldDecodeUnmappedCandidate: boolean;
	confirmed: boolean;
	promiscuous: boolean;
	url: string | undefined;
}): 'known_live' | 'confirmed' | 'unmapped_candidate' | 'promiscuous' | 'ignored' {
	if (shouldDecodeUnmappedCandidate) return 'unmapped_candidate';
	if (confirmed) return 'confirmed';
	if (url?.includes(liveSocketPattern)) return 'known_live';
	if (shouldDecodeKnownSocket && promiscuous) return 'promiscuous';
	return 'ignored';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string | undefined {
	return error instanceof Error ? error.stack : undefined;
}
