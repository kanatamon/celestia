import invariant from 'tiny-invariant';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { TikTokLiveEventSource } from './tiktok-live-events';

interface RetryConfiguration {
	maxRetries?: number; // How many times to retry connection
	maxReconnectDelay?: number; // Max delay between retries in ms
	initialDelay?: number; // Initial delay before first retry in ms
	backoffFactor?: number; // Factor to increase delay after each retry
}

class TikTokLiveClient {
	private source: TikTokLiveEventSource | null = null;
	private subscribers = new Set<string>(); // Track components using service
	private currentUsername: string | null = null;

	// Retry mechanism properties
	private retryConfig: Required<RetryConfiguration> = {
		maxRetries: 5,
		maxReconnectDelay: 30000, // 30 seconds
		initialDelay: 1000, // 1 second
		backoffFactor: 2,
	};
	private currentRetryCount = 0;
	private retryTimeoutId: number | null = null;
	private isManuallyDisconnected = false;

	constructor(private readonly store = useTikTokLiveStore.getState()) {}

	connect(
		username: string,
		componentId: string = crypto.randomUUID(),
		retryConfig?: Partial<RetryConfiguration>,
	) {
		this.subscribers.add(componentId);

		// Update retry configuration if provided
		if (retryConfig) {
			this.retryConfig = { ...this.retryConfig, ...retryConfig };
		}

		// Only create connection if this is the first subscriber
		// OR if username changed
		if (!this.source || this.currentUsername !== username) {
			this.disconnect(); // Clean up previous connection
			this.currentUsername = username;
			this.isManuallyDisconnected = false;
			this.currentRetryCount = 0;

			console.log(`🔌 Creating TikTok connection for: @${username}`);
			this._createConnection();
		} else {
			console.log(`♻️ Reusing existing connection for: @${username}`);
		}

		return componentId; // Return ID for cleanup
	}

	private _createConnection(
		phase: 'connecting' | 'reconnecting' = 'connecting',
	) {
		invariant(
			this.currentUsername,
			'Username must be set before creating connection',
		);

		// Clear any existing retry timeout
		this._clearRetryTimeout();

		// Update store to connecting state
		this.store.updateConnection({
			status: phase,
		});

		this.source = new TikTokLiveEventSource(
			`/sse/tiktok-live/${this.currentUsername}`,
			{
				onError: (error) => {
					this._handleConnectionError(error, phase);
				},
			},
		);

		// Set up event handlers
		this.setupEventHandlers();
	}

	private _handleConnectionError(
		error: Error,
		phase: 'connecting' | 'reconnecting' = 'connecting',
	) {
		console.error(
			`❌ TikTok connection error for @${this.currentUsername}:`,
			error.message,
		);

		// Don't retry if manually disconnected
		if (this.isManuallyDisconnected) {
			return;
		}

		// Update store with error
		this.store.updateConnection({
			status: 'error',
			error: error.message,
		});

		// Close the current source
		if (this.source) {
			this.source.close();
			this.source = null;
		}

		// Attempt retry if within limits
		if (this.currentRetryCount < this.retryConfig.maxRetries) {
			this._scheduleRetry(phase);
		} else {
			this._handleMaxRetriesExceeded();
		}
	}

	private _scheduleRetry(phase: 'connecting' | 'reconnecting' = 'connecting') {
		const delay = Math.min(
			this.retryConfig.initialDelay *
				Math.pow(this.retryConfig.backoffFactor, this.currentRetryCount),
			this.retryConfig.maxReconnectDelay,
		);

		console.log(
			`🔄 Scheduling retry ${this.currentRetryCount + 1}/${this.retryConfig.maxRetries} ` +
				`for @${this.currentUsername} in ${delay}ms`,
		);

		// Update store to retrying state
		this.store.updateConnection({
			status: phase,
		});

		this.retryTimeoutId = window.setTimeout(() => {
			this.currentRetryCount++;
			this._createConnection(phase);
		}, delay);
	}

	private _handleMaxRetriesExceeded() {
		console.error(`💥 Max retries exceeded for @${this.currentUsername}`);

		this.store.updateConnection({
			status: 'error',
			error: `Failed to connect after ${this.retryConfig.maxRetries} attempts`,
		});
	}

	private _clearRetryTimeout() {
		if (this.retryTimeoutId) {
			clearTimeout(this.retryTimeoutId);
			this.retryTimeoutId = null;
		}
	}

	/**
	 * Manually retry the connection (resets retry count)
	 */
	retry(componentId?: string): boolean {
		// Verify the component requesting retry is a subscriber
		if (componentId && !this.subscribers.has(componentId)) {
			console.warn(
				`Component ${componentId} is not subscribed, ignoring retry request`,
			);
			return false;
		}

		if (!this.currentUsername) {
			console.warn('No username set, cannot retry connection');
			return false;
		}

		console.log(`🔄 Manual retry requested for @${this.currentUsername}`);

		// Reset retry count for manual retry
		this.currentRetryCount = 0;
		this.isManuallyDisconnected = false;

		// Clear any pending retry
		this._clearRetryTimeout();

		// Force reconnection
		this._createConnection('reconnecting');

		return true;
	}

	disconnect(componentId?: string) {
		if (componentId) {
			this.subscribers.delete(componentId);
		}

		// Only disconnect if no more subscribers
		if (this.subscribers.size === 0) {
			console.log(`🔌 Disconnecting TikTok service - no more subscribers`);

			this.isManuallyDisconnected = true;
			this._clearRetryTimeout();

			if (this.source) {
				this.source.close();
				this.source = null;
			}

			this.store.updateConnection({
				status: 'disconnected',
				reason: `No subscribers left for @${this.currentUsername}`,
			});

			this.currentUsername = null;
			this.currentRetryCount = 0;
		} else {
			console.log(
				`👥 ${this.subscribers.size} components still using connection`,
			);
		}
	}

	/**
	 * Force disconnect all subscribers and stop retrying
	 */
	forceDisconnect() {
		console.log('🛑 Force disconnecting TikTok service');

		this.isManuallyDisconnected = true;
		this.subscribers.clear();
		this._clearRetryTimeout();

		if (this.source) {
			this.source.close();
			this.source = null;
		}

		this.store.updateConnection({
			status: 'disconnected',
			reason: 'Force disconnected',
		});

		this.currentUsername = null;
		this.currentRetryCount = 0;
	}

	// Utility methods
	clearStore() {
		this.store.clearAllEvents();
	}

	private setupEventHandlers() {
		invariant(this.source, 'TikTokLiveEventSource is not initialized');

		this.source.onEvents({
			live_stream: (data) => {
				this.store.updateConnection(data);
			},
			chat: (data) => {
				this.store.addChatEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'chat',
					data,
				});
			},
			gift: (data) => {
				// TODO: Group repeated gifts from the same user
				this.store.addChatEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'gift',
					data,
				});
			},
			follow: (data) => {
				this.store.addChatEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'follow',
					data,
				});
			},
			share: (data) => {
				this.store.addChatEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'share',
					data,
				});
			},
			like: (data) => {
				this.store.addInteractionEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'like',
					data,
				});
			},
			room_user: (data) => {
				this.store.updateViewerCount(data.viewerCount);
				this.store.updateConnection({
					status: 'live',
				});
			},
			member: (data) => {
				this.store.addJoinEvent({
					id: data.event?.msgId || crypto.randomUUID(),
					event: 'member',
					data,
				});
			},
		});
	}

	getConnectionInfo() {
		return {
			isConnected: !!this.source,
			subscriberCount: this.subscribers.size,
			currentUsername: this.currentUsername,
			subscribers: Array.from(this.subscribers),
			retryCount: this.currentRetryCount,
			maxRetries: this.retryConfig.maxRetries,
			isRetrying: this.retryTimeoutId !== null,
		};
	}

	/**
	 * Update retry configuration
	 */
	updateRetryConfig(config: Partial<RetryConfiguration>) {
		this.retryConfig = { ...this.retryConfig, ...config };
		console.log('🔧 Updated retry configuration:', this.retryConfig);
	}

	/**
	 * Get current retry configuration
	 */
	getRetryConfig(): Required<RetryConfiguration> {
		return { ...this.retryConfig };
	}
}

export const tikTokLiveClient = new TikTokLiveClient();
