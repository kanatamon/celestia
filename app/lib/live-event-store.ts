import type {
	User,
	WebcastChatMessage,
	WebcastGiftMessage,
	WebcastLikeMessage,
	WebcastMemberMessage,
	WebcastMessageEvent,
} from './live-event-types';
import type { ConnectionStatus } from './tiktok-live-events';
import { create } from 'zustand';
import {
	createJSONStorage,
	persist,
	subscribeWithSelector,
} from 'zustand/middleware';

export type LiveChatMessage = WebcastChatMessage & {
	id: string;
	type: 'chat';
	event: WebcastMessageEvent;
};

export type LiveGiftMessage = WebcastGiftMessage & {
	id: string;
	type: 'gift';
	event: WebcastMessageEvent;
};

export type LiveLikeMessage = WebcastLikeMessage & {
	id: string;
	type: 'like';
	event: WebcastMessageEvent;
};

export type LiveMemberMessage = WebcastMemberMessage & {
	id: string;
	type: 'member';
	event: WebcastMessageEvent;
};

export type LiveFeedMessage = LiveChatMessage | LiveGiftMessage;

type InteractionEvent = LiveLikeMessage;

export type LiveStreamConnection = {
	status: ConnectionStatus;
	message?: string; // Optional message for more specific context
};

interface LiveEventStore {
	// Connection state
	connection: LiveStreamConnection;
	viewerCount: number;
	likeCount: number;

	// Events for chat feed (messages + major gifts)
	chatEvents: LiveFeedMessage[];

	// Event for gifts by users
	userGiftEvents: Map<User['uniqueId'], LiveGiftMessage[]>;

	// Events for bubble-like interactions (likes, etc.)
	interactionEvents: InteractionEvent[];

	// Events for join notifications
	joinEvents: LiveMemberMessage[];

	// Actions
	addChatEvent: (newData: LiveFeedMessage) => void;
	addJoinEvent: (newData: LiveMemberMessage) => void;
	addInteractionEvent: (newData: InteractionEvent) => void;
	removeInteractionEvent: (id: string) => void;
	updateConnection: (status: LiveStreamConnection) => void;
	updateViewerCount: (count: number) => void;
	clearAllEvents: () => void;
}

export const useLiveEventStore = create<LiveEventStore>()(
	subscribeWithSelector(
		persist(
			(set, get) => {
				const MAX_CHAT_EVENTS = 1000;
				const MAX_JOIN_EVENTS = 100;
				const MAX_INTERACTION_EVENTS = 100;

				const addChatEvent = (newData: LiveFeedMessage) => {
					set((state) => {
						const filteredChatEvents = state.chatEvents
							.slice(-MAX_CHAT_EVENTS)
							.filter((storedData) => {
								/**
								 * Duplication removal logic
								 */
								if (storedData.id === newData.id) {
									return false;
								}

								/**
								 * Gift Message Deduplication Logic
								 *
								 * Problem: When users rapidly send the same gift (e.g. 5 roses), TikTok creates
								 * multiple messages with the same groupId but different repeat counts
								 *
								 * Solution: Only display the latest message from each gift group
								 * - Remove old messages with matching groupId
								 * - Keep the newest one which contains the final repeat count
								 *
								 * Example:
								 * User sends 5 roses rapidly:
								 * - Message 1: "Rose x1" (groupId: "abc123")
								 * - Message 2: "Rose x3" (groupId: "abc123") <- removes message 1
								 * - Message 3: "Rose x5" (groupId: "abc123") <- removes message 2
								 * Final display: Only "Rose x5" is shown
								 */
								if (newData.type === 'gift' && storedData.type === 'gift') {
									return storedData.groupId !== newData.groupId;
								}

								return true;
							});

						return {
							chatEvents: [...filteredChatEvents, newData],
						};
					});

					if (newData.type === 'gift' && newData.uniqueId) {
						const userUniqueId = newData.uniqueId;
						set((state) => {
							const userGifts = state.userGiftEvents.get(userUniqueId) || [];
							return {
								userGiftEvents: new Map(state.userGiftEvents).set(
									userUniqueId,
									[...userGifts, newData],
								),
							};
						});
					}
				};

				const addJoinEvent = (newData: LiveMemberMessage) => {
					set((state) => ({
						joinEvents: [...state.joinEvents.slice(-MAX_JOIN_EVENTS), newData],
					}));
				};

				const addInteractionEvent = (newData: InteractionEvent) => {
					if (newData.type === 'like') {
						set((state) => ({
							likeCount: state.likeCount + newData.likeCount,
						}));
					}
					set((state) => ({
						interactionEvents: [
							...state.interactionEvents.slice(-MAX_INTERACTION_EVENTS),
							newData,
						],
					}));
				};

				const removeInteractionEvent = (id: string) => {
					set((state) => ({
						interactionEvents: state.interactionEvents.filter(
							(e) => e.id !== id,
						),
					}));
				};

				const updateConnection = (status: LiveStreamConnection) => {
					set({ connection: status });
				};

				const updateViewerCount = (count: number) => {
					set({ viewerCount: count });
				};

				const clearAllEvents = () => {
					set({
						viewerCount: 0,
						likeCount: 0,
						chatEvents: [],
						userGiftEvents: new Map(),
						interactionEvents: [],
						joinEvents: [],
					});
				};

				return {
					connection: { status: 'connecting' },
					likeCount: 0,
					viewerCount: 0,
					chatEvents: [],
					userGiftEvents: new Map(),
					interactionEvents: [],
					joinEvents: [],
					addChatEvent,
					addJoinEvent,
					addInteractionEvent,
					removeInteractionEvent,
					updateConnection,
					updateViewerCount,
					clearAllEvents,
				};
			},
			{
				name: 'tiktok-live-events-store',
				storage: createJSONStorage(() => localStorage),

				// 🎯 ONLY persist these 3 fields
				partialize: (state) => ({
					likeCount: state.likeCount,
					chatEvents: state.chatEvents,
					userGiftEvents: Array.from(state.userGiftEvents.entries()),
				}),

				// Handle rehydration - convert Array back to Map
				onRehydrateStorage: () => (state) => {
					if (state && Array.isArray(state.userGiftEvents)) {
						state.userGiftEvents = new Map(state.userGiftEvents);
					}
				},

				// Handle version migrations if needed
				version: 2,
			},
		),
	),
);
