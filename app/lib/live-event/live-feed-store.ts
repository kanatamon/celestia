import { create } from 'zustand';
import {
	createJSONStorage,
	persist,
	subscribeWithSelector,
} from 'zustand/middleware';

interface LiveFeedStore {
	pinnedMessageIdOnFeeds: Map<string, string | null | undefined>;

	updatePinnedMessageIdOnFeeds: (
		feedId: string,
		messageId: string | null | undefined,
	) => void;
	getPinnedMessageIdOnFeeds: (feedId: string) => string | null | undefined;
	reset: () => void;
}

export const useLiveFeedStore = create<LiveFeedStore>()(
	subscribeWithSelector(
		persist(
			(set, get) => {
				return {
					pinnedMessageIdOnFeeds: new Map(),

					updatePinnedMessageIdOnFeeds: (
						feedId: string,
						messageId: string | null | undefined,
					) => {
						set((state) => {
							const newMap = new Map(state.pinnedMessageIdOnFeeds);
							newMap.set(feedId, messageId);
							return {
								pinnedMessageIdOnFeeds: newMap,
							};
						});
					},

					getPinnedMessageIdOnFeeds: (feedId: string) => {
						return get().pinnedMessageIdOnFeeds.get(feedId);
					},

					reset: () => {
						set(() => ({
							pinnedMessageIdOnFeeds: new Map(),
						}));
					},
				};
			},
			{
				name: 'live-feed-store',
				storage: createJSONStorage(() => localStorage),

				partialize: (state) => ({
					pinnedMessageIdOnFeeds: Array.from(
						state.pinnedMessageIdOnFeeds.entries(),
					),
				}),

				onRehydrateStorage: () => (state, error) => {
					if (error) {
						console.error('Failed to rehydrate Zustand store:', error);
						return;
					}

					if (!state) {
						console.warn('Rehydrated Zustand store is undefined');
						return;
					}

					if (Array.isArray(state.pinnedMessageIdOnFeeds)) {
						state.pinnedMessageIdOnFeeds = new Map(
							state.pinnedMessageIdOnFeeds,
						);
					}
				},

				// Handle version migrations if needed
				version: 1,
			},
		),
	),
);
