import type {
	WebcastChatMessage,
	WebcastEmoteChatMessage,
	WebcastEnvelopeMessage,
	WebcastGiftMessage,
	WebcastLikeMessage,
	WebcastLinkMicArmies,
	WebcastLinkMicBattle,
	WebcastLiveIntroMessage,
	WebcastMemberMessage,
	WebcastQuestionNewMessage,
	WebcastRoomUserSeqMessage,
	WebcastSocialMessage,
	WebcastSubNotifyMessage,
} from 'tiktok-live-connector';

export type ConnectionStatus =
	// Initial States
	| 'connecting' // Establishing Client→Server→TikTok chain

	// Intermediate States
	| 'tiktok:authenticating' // Server connecting to TikTok API
	| 'tiktok:room_found' // Got roomId but no live activity yet

	// Active States
	| 'tiktok:live_active' // 🟢 Receiving real events - stream confirmed active

	// End States
	| 'tiktok:stream_ended' // Stream officially ended
	| 'tiktok:stream_offline' // Room exists but streamer went offline

	// Error States
	| 'connection_lost' // Lost connection somewhere in chain
	| 'reconnecting' // Attempting to reconnect
	| 'server_error' // Our server issue
	| 'tiktok:error' // TikTok API issue
	| 'tiktok:room_not_found'; // Room not found or invalid username

export const isConnectionError = (status: string) => {
	return (
		status === 'connection_lost' ||
		status === 'server_error' ||
		status === 'tiktok:error' ||
		status === 'tiktok:room_not_found'
	);
};

type _TikTokLiveEvent =
	| {
			event: 'connection';
			data: {
				status: ConnectionStatus;
				message?: string; // Optional message for more specific context
			};
	  }
	| {
			event: 'chat';
			data: WebcastChatMessage;
	  }
	| {
			event: 'gift';
			data: WebcastGiftMessage;
	  }
	| {
			event: 'follow';
			data: WebcastSocialMessage;
	  }
	| {
			event: 'like';
			data: WebcastLikeMessage;
	  }
	| {
			event: 'question_new';
			data: WebcastQuestionNewMessage;
	  }
	| {
			event: 'room_user';
			data: WebcastRoomUserSeqMessage;
	  }
	| {
			event: 'member';
			data: WebcastMemberMessage;
	  }
	| {
			event: 'social';
			data: WebcastSocialMessage;
	  }
	| {
			event: 'link_mic_battle';
			data: WebcastLinkMicBattle;
	  }
	| {
			event: 'link_mic_armies';
			data: WebcastLinkMicArmies;
	  }
	| {
			event: 'live_intro';
			data: WebcastLiveIntroMessage;
	  }
	| {
			event: 'emote';
			data: WebcastEmoteChatMessage;
	  }
	| {
			event: 'envelope';
			data: WebcastEnvelopeMessage;
	  }
	| {
			event: 'subscribe';
			data: WebcastSubNotifyMessage;
	  }
	| {
			event: 'share';
			data: WebcastSocialMessage;
	  };

// Extract event names for type safety
export type TikTokLiveEventName = _TikTokLiveEvent['event'];

// Helper type to get data type for specific event
export type TikTokLiveEventData<T extends TikTokLiveEventName> = Extract<
	_TikTokLiveEvent,
	{ event: T }
>['data'];

export type TikTokLiveEvent<T extends TikTokLiveEventName> = {
	event: T;
	data: TikTokLiveEventData<T>;
};

// Server-side helpers
export class TikTokLiveEventSender {
	constructor(
		private _send: (event: { event: string; data: string }) => void,
	) {}

	send<T extends TikTokLiveEventName>(
		event: T,
		data: TikTokLiveEventData<T>,
	): void {
		this._send({
			event,
			data: JSON.stringify(data),
		});
	}
}

// Client-side helpers
export type TikTokLiveEventHandler<T extends TikTokLiveEventName> = (
	data: TikTokLiveEventData<T>,
) => void;

export type TikTokLiveEventHandlers = {
	[K in TikTokLiveEventName]?: TikTokLiveEventHandler<K>;
};

export class TikTokLiveEventSource {
	private source: EventSource;
	private controllers: AbortController[] = [];

	constructor(
		url: string,
		options?: EventSourceInit & {
			onError?: (error: Error) => void;
		},
	) {
		const { onError, ...eventSourceOptions } = options || {};
		this.source = new EventSource(url, eventSourceOptions);

		const controller = new AbortController();
		this.controllers.push(controller);

		this.source.addEventListener(
			'error',
			(event) => {
				if (event instanceof ErrorEvent) {
					onError?.(new Error(event.message));
				} else {
					onError?.(new Error(`Failed to connect to TikTok Live service`));
				}
			},
			{
				signal: controller.signal,
			},
		);
	}

	on<T extends TikTokLiveEventName>(
		eventName: T,
		handler: TikTokLiveEventHandler<T>,
		options?: { signal?: AbortSignal },
	): void {
		const controller = new AbortController();
		this.controllers.push(controller);

		// Combine external signal with internal controller
		const combinedSignal = options?.signal
			? this.combineSignals(options.signal, controller.signal)
			: controller.signal;

		this.source.addEventListener(
			eventName,
			(event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as TikTokLiveEventData<T>;
					handler(data);
				} catch (error) {
					console.error(`Failed to parse ${eventName} event data:`, error);
				}
			},
			{ signal: combinedSignal },
		);
	}

	// Method to register multiple handlers at once
	onEvents(handlers: TikTokLiveEventHandlers): void {
		(
			Object.entries(handlers) as Array<
				[TikTokLiveEventName, TikTokLiveEventHandler<any>]
			>
		).forEach(([eventName, handler]) => {
			this.on(eventName, handler);
		});
	}

	close(): void {
		this.controllers.forEach((controller) => controller.abort());
		this.source.close();
	}

	private combineSignals(
		signal1: AbortSignal,
		signal2: AbortSignal,
	): AbortSignal {
		const controller = new AbortController();

		const abort = () => controller.abort();

		if (signal1.aborted || signal2.aborted) {
			abort();
		} else {
			signal1.addEventListener('abort', abort, { once: true });
			signal2.addEventListener('abort', abort, { once: true });
		}

		return controller.signal;
	}
}
