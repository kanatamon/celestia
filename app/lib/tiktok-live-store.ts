import type { ConnectionStatus, TikTokLiveEvent } from './tiktok-live-events';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type WithId<T> = T & { id: string };

type ChatEvent =
	| TikTokLiveEvent<'chat'>
	| TikTokLiveEvent<'gift'>
	| TikTokLiveEvent<'follow'>
	| TikTokLiveEvent<'share'>
	| TikTokLiveEvent<'subscribe'>;

type InteractionEvent = TikTokLiveEvent<'like'>;

export type LiveStreamConnection = {
	status: ConnectionStatus;
	message?: string; // Optional message for more specific context
};

interface TikTokLiveStore {
	// Connection state
	connection: LiveStreamConnection;
	viewerCount: number;

	// Events for chat feed (messages + major gifts)
	chatEvents: WithId<ChatEvent>[];

	// Events for bubble-like interactions (likes, etc.)
	interactionEvents: WithId<InteractionEvent>[];

	// Events for join notifications
	joinEvents: WithId<TikTokLiveEvent<'member'>>[];

	// Actions
	addChatEvent: (event: WithId<ChatEvent>) => void;
	addJoinEvent: (event: WithId<TikTokLiveEvent<'member'>>) => void;
	addInteractionEvent: (event: WithId<InteractionEvent>) => void;
	removeInteractionEvent: (id: string) => void;
	updateConnection: (status: LiveStreamConnection) => void;
	updateViewerCount: (count: number) => void;
	clearAllEvents: () => void;
}

export const useTikTokLiveStore = create<TikTokLiveStore>()(
	subscribeWithSelector((set, get) => ({
		connection: {
			status: 'connecting',
		},
		viewerCount: 0,
		chatEvents: [],
		interactionEvents: [],
		joinEvents: [],

		addChatEvent: (event) =>
			set((state) => ({
				chatEvents: [...state.chatEvents.slice(-1000), event], // Keep last 1000 events to prevent memory issues
			})),

		addJoinEvent: (event) =>
			set((state) => ({
				joinEvents: [
					...state.joinEvents.slice(-100), // Keep last 100 join events
					event,
				],
			})),

		addInteractionEvent: (event) =>
			set((state) => ({
				interactionEvents: [...state.interactionEvents, event],
			})),

		removeInteractionEvent: (id) =>
			set((state) => ({
				interactionEvents: state.interactionEvents.filter((e) => e.id !== id),
			})),

		updateConnection: (status) =>
			set({
				connection: status,
			}),

		updateViewerCount: (count) =>
			set({
				viewerCount: count,
			}),

		clearAllEvents: () =>
			set({
				chatEvents: [],
				interactionEvents: [],
				joinEvents: [],
			}),
	})),
);
