import type { LiveFeedMessage } from './live-event/live-event-store';
import { useCallback, useEffect, useRef } from 'react';
import { SoundManager } from './sound-manager';
import { userAttentionManager } from './user-attention-manager.client';

interface NotificationConfig {
	soundUrl: string;
	volume?: number;
	showBrowserNotification?: boolean;
	notificationTitle?: string;
	priority?: 'low' | 'normal' | 'high';
}

type SoundMapping = Record<
	LiveFeedMessage['type'] | 'default',
	NotificationConfig
>;

// Hook options
interface UseChatNotificationsOptions {
	soundMapping?: SoundMapping;
	enableWhenUserActive?: boolean;
	onNotificationPlayed?: (
		event: LiveFeedMessage,
		config: NotificationConfig,
	) => void;
	onUserReturns?: (
		missedCount: number,
		missedEvents: LiveFeedMessage[],
	) => void;
	enableBrowserNotifications?: boolean;
}

// Default sound mapping for Oracle Reader
const DEFAULT_SOUND_MAPPING: SoundMapping = {
	chat: {
		soundUrl: '/cartoon-bubbles-popping-gfx-sounds-3-3-00-00.mp3',
		volume: 0.7,
		showBrowserNotification: false,
		notificationTitle: 'New Chat Message',
		priority: 'normal',
	},
	gift: {
		soundUrl: '/Heal.wav',
		volume: 0.7,
		showBrowserNotification: false,
		notificationTitle: 'Gift Received!',
		priority: 'high',
	},
	default: {
		soundUrl: '/cartoon-bubbles-popping-gfx-sounds-3-3-00-00.mp3',
		volume: 0.5,
		showBrowserNotification: false,
		notificationTitle: 'New Activity',
		priority: 'low',
	},
};

export const useChatNotifications = (
	chatEvents: LiveFeedMessage[],
	options: UseChatNotificationsOptions = {},
) => {
	const {
		soundMapping = DEFAULT_SOUND_MAPPING,
		enableWhenUserActive = false,
		onNotificationPlayed,
		onUserReturns,
		enableBrowserNotifications = true,
	} = options;

	// Track processed events to avoid duplicates
	const processedEventsRef = useRef<Set<string>>(new Set());
	const missedEventsRef = useRef<LiveFeedMessage[]>([]);
	const lastUserAttentionState = useRef(userAttentionManager.getState());

	// Play notification sound and handle browser notification
	const playNotification = useCallback(
		async (event: LiveFeedMessage, config: NotificationConfig) => {
			try {
				await SoundManager.play(config.soundUrl, {
					volume: config.volume || 0.5,
				});

				if (enableBrowserNotifications && config.showBrowserNotification) {
					if (
						'Notification' in window &&
						Notification.permission === 'granted'
					) {
						new Notification(config.notificationTitle || 'New Activity', {
							body:
								event.type === 'chat'
									? `${event.nickname || event.uniqueId}: ${event.comment}`
									: `${event.nickname || event.uniqueId} sent ${event.giftName}`,
							icon: '/favicon.ico',
							tag: `oracle-${event.type}`,
							requireInteraction: config.priority === 'high',
						});
					}
				}

				onNotificationPlayed?.(event, config);
			} catch (error) {
				console.error('Error playing notification:', error);
			}
		},
		[enableBrowserNotifications, onNotificationPlayed],
	);

	const getNotificationConfig = useCallback(
		(eventType: LiveFeedMessage['type']): NotificationConfig => {
			if (soundMapping[eventType]) {
				return soundMapping[eventType];
			}
			if (soundMapping.default) {
				return soundMapping.default;
			}
			return DEFAULT_SOUND_MAPPING.default;
		},
		[soundMapping],
	);

	// Process new chat events
	useEffect(() => {
		const newEvents = chatEvents.filter(
			(event) => !processedEventsRef.current.has(event.id),
		);

		if (newEvents.length === 0) return;

		// Mark events as processed
		newEvents.forEach((event) => {
			processedEventsRef.current.add(event.id);
		});

		const currentAttentionState = userAttentionManager.getState();
		const shouldPlayNotification =
			enableWhenUserActive || !currentAttentionState.isActive;

		if (shouldPlayNotification) {
			// Process each new event
			newEvents.forEach((event) => {
				const config = getNotificationConfig(event.type);

				if (!currentAttentionState.isActive) {
					// User is away - add to missed events and play notification
					missedEventsRef.current.push(event);
				}

				playNotification(event, config);
			});
		} else {
			// User is active but we're not playing notifications - still track as missed if needed
			newEvents.forEach((event) => {
				if (!currentAttentionState.isActive) {
					missedEventsRef.current.push(event);
				}
			});
		}
	}, [
		chatEvents,
		enableWhenUserActive,
		getNotificationConfig,
		playNotification,
	]);

	// Handle user returning (attention state changes)
	useEffect(() => {
		const handleAttentionChange = () => {
			const currentState = userAttentionManager.getState();
			const previousState = lastUserAttentionState.current;

			// User returned (became active)
			if (!previousState.isActive && currentState.isActive) {
				if (missedEventsRef.current.length > 0) {
					onUserReturns?.(missedEventsRef.current.length, [
						...missedEventsRef.current,
					]);
					missedEventsRef.current = []; // Clear missed events
				}
			}

			lastUserAttentionState.current = currentState;
		};

		const unsubscribe = userAttentionManager.subscribe(handleAttentionChange);
		return unsubscribe;
	}, [onUserReturns]);

	return {
		missedCount: missedEventsRef.current.length,
		missedEvents: [...missedEventsRef.current],
		isUserActive: userAttentionManager.getState().isActive,
		clearMissedEvents: () => {
			missedEventsRef.current = [];
		},
		playNotificationForEvent: (event: LiveFeedMessage) => {
			const config = getNotificationConfig(event.type);
			return playNotification(event, config);
		},
	};
};
