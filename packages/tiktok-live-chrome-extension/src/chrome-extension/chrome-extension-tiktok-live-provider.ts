import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
} from '@celestia/tiktok-live-core';
import { DedupWindow, decodeWebcastFrame } from '../protocol/decode-webcast-frame.js';
import type { ChromeConnectionState } from '../types/chrome-connection-state.js';
import {
	ChromeApiDebuggerTransport,
	type ChromeDebuggerTransport,
	type Debuggee,
} from './chrome-debugger-transport.js';

const liveSocketPattern = 'webcast-ws.tiktok.com/webcast/im/ws_proxy/';
const promiscuousModeDelayMs = 10_000;
const socketTrackingMethods = new Set([
	'Network.webSocketCreated',
	'Network.webSocketWillSendHandshakeRequest',
	'Network.webSocketHandshakeResponseReceived',
]);

export interface ChromeExtensionTikTokLiveProviderOptions {
	transport?: ChromeDebuggerTransport;
	now?: () => number;
	setTimeout?: typeof globalThis.setTimeout;
	clearTimeout?: typeof globalThis.clearTimeout;
}

export class ChromeExtensionTikTokLiveProvider implements TikTokLiveProvider {
	private state: ChromeConnectionState = emptyState('idle');
	private readonly eventHandlers = new Set<(event: LiveEvent) => void>();
	private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
	private readonly logHandlers = new Set<(log: ProviderLog) => void>();
	private readonly sockets = new Map<string, string>();
	private readonly dedupWindow = new DedupWindow();
	private readonly transport: ChromeDebuggerTransport;
	private readonly now: () => number;
	private readonly setTimer: typeof globalThis.setTimeout;
	private readonly clearTimer: typeof globalThis.clearTimeout;
	private promiscuousTimer: ReturnType<typeof setTimeout> | undefined;
	private destroyed = false;

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
		this.clearPromiscuousTimer();
		this.setState({ ...this.state, status: 'detached', tabId: undefined, attachedAt: undefined });
		this.emitLog('warn', 'Chrome debugger detached', { reason });
	};

	constructor(options: ChromeExtensionTikTokLiveProviderOptions = {}) {
		this.transport = options.transport ?? new ChromeApiDebuggerTransport();
		this.now = options.now ?? Date.now;
		this.setTimer = options.setTimeout ?? globalThis.setTimeout;
		this.clearTimer = options.clearTimeout ?? globalThis.clearTimeout;
		this.transport.addEventListener(this.handleDebuggerEvent);
		this.transport.addDetachListener(this.handleDebuggerDetach);
		this.emitLog('debug', 'Chrome Extension Provider constructed');
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

		if (this.state.tabId !== undefined && this.state.tabId !== tab.id) {
			await this.detach();
		}

		const debuggee = { tabId: tab.id };
		this.setState({
			...this.state,
			status: 'attaching',
			tabId: tab.id,
			tabUrl: tab.url,
			username,
		});

		try {
			this.emitLog('info', 'Attaching Chrome debugger', debuggee);
			await this.transport.attach(debuggee);
			this.emitLog('info', 'Enabling Chrome debugger Network domain', debuggee);
			await this.transport.enableNetwork(debuggee);
			this.sockets.clear();
			this.setState({
				...this.state,
				status: 'attached',
				username,
				attachedAt: this.now(),
				socketCount: 0,
				confirmedSocketUrl: undefined,
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
			await this.transport.detach(debuggee);
			this.clearPromiscuousTimer();
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
		return () => this.logHandlers.delete(handler);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.transport.removeEventListener(this.handleDebuggerEvent);
		this.transport.removeDetachListener(this.handleDebuggerDetach);
		this.clearPromiscuousTimer();
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
			this.trackSocket(params);
			return;
		}

		if (method !== 'Network.webSocketFrameReceived') return;
		const requestId = stringParam(params, 'requestId');
		const url = requestId === undefined ? undefined : this.sockets.get(requestId);
		if (!this.shouldDecodeSocket(url)) {
			if (url !== undefined) {
				this.emitLog('debug', 'Ignoring WebSocket frame from unconfirmed socket', {
					requestId,
					url,
					promiscuousMode: this.state.promiscuousMode,
				});
			}
			return;
		}
		const response = params.response;
		if (!isRecord(response)) return;
		const payloadData = stringParam(response, 'payloadData');
		if (payloadData === undefined) return;

		try {
			const result = decodeWebcastFrame(payloadData, this.dedupWindow);
			if (result.skipped) {
				this.emitLog('debug', 'Skipped WebSocket frame envelope', {
					requestId,
					url,
					envelopeType: result.envelopeType,
				});
				return;
			}
			if (url && this.state.confirmedSocketUrl === undefined) {
				this.clearPromiscuousTimer();
				this.emitLog('info', 'Confirmed TikTok Live WebSocket', { url });
				this.setState({
					...this.state,
					status: 'connected',
					confirmedSocketUrl: url,
					promiscuousMode: false,
				});
			}
			this.emitLog('debug', 'Decoded WebSocket frame', {
				requestId,
				url,
				eventCount: result.events.length,
			});
			for (const event of result.events) {
				this.emitEvent(event);
			}
		} catch (error) {
			this.setState({ ...this.state, decodeFailures: this.state.decodeFailures + 1 });
			this.emitLog('debug', 'Failed to decode WebSocket frame', {
				requestId,
				url,
				error: errorMessage(error),
			});
		}
	}

	private trackSocket(params: Record<string, unknown>): void {
		const requestId = stringParam(params, 'requestId');
		const url = stringParam(params, 'url') ?? nestedStringParam(params, 'request', 'url');
		if (requestId === undefined || url === undefined) return;
		this.sockets.set(requestId, url);
		this.emitLog(url.includes(liveSocketPattern) ? 'info' : 'debug', 'Tracked WebSocket', {
			requestId,
			url,
			socketCount: this.sockets.size,
			matchesLiveSocketPattern: url.includes(liveSocketPattern),
		});
		this.setState({ ...this.state, socketCount: this.sockets.size });
	}

	private shouldDecodeSocket(url: string | undefined): boolean {
		if (this.state.confirmedSocketUrl !== undefined) return url === this.state.confirmedSocketUrl;
		if (url?.includes(liveSocketPattern)) return true;
		return this.state.promiscuousMode;
	}

	private schedulePromiscuousMode(): void {
		this.clearPromiscuousTimer();
		this.promiscuousTimer = this.setTimer(() => {
			if (this.state.status === 'attached' && this.state.confirmedSocketUrl === undefined) {
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
		this.setState({ ...this.state, eventCount: this.state.eventCount + 1 });
		this.emitLog('debug', 'Emitting LiveEvent', {
			id: event.id,
			type: event.type,
			totalEventCount: this.state.eventCount,
		});
		for (const handler of this.eventHandlers) handler(event);
	}

	private setState(state: ChromeConnectionState): void {
		if (state.status !== this.state.status) {
			this.emitLog('info', 'Connection state changed', {
				from: this.state.status,
				to: state.status,
				tabId: state.tabId,
				socketCount: state.socketCount,
				eventCount: state.eventCount,
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
		this.emitLog('error', 'Chrome Extension Provider failed', { error: errorMessage(error) });
		this.setState({ ...this.state, status: 'error' });
		return this.state;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
