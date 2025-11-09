import type { LiveGiftMessage } from './live-event-store';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Call this once at app initialization (e.g., in main.tsx or App.tsx)
enableMapSet();

// ============================================================================
// Types
// ============================================================================

// Flow:
// waiting → settling → completed → reverting → waiting
type QueueState = 'waiting' | 'settling' | 'completed' | 'reverting';

enum PriorityTier {
	VIP = 1,
	PREMIUM = 2,
	STANDARD = 3,
	FREE = 4,
}

export interface QueueItem {
	id: string;
	gift: LiveGiftMessage;
	tier: PriorityTier;
	state: QueueState;
	position: number;
	createdAt: number;
	settlingAt?: number;
	revertingAt?: number;
	completedAt?: number;
}

interface QueueStats {
	total: number;
	waiting: number;
	processing: number;
	settling: number;
	completed: number;
	reverting: number;
	byTier: Record<PriorityTier, number>;
}

// ============================================================================
// Store State & Actions
// ============================================================================

interface GiftQueueStore {
	// State
	items: QueueItem[];
	// settlingTimers: Map<string, NodeJS.Timeout>;

	// Computed (selectors)
	stats: QueueStats;

	// Actions
	addGiftToQueue: (event: LiveGiftMessage) => QueueItem | null;
	moveToWaiting: (itemId: string) => void;
	moveToReverting: (itemId: string) => void;
	cancelReverting: (itemId: string) => void;
	moveToSettling: (itemId: string) => void;
	cancelSettling: (itemId: string) => void;
	moveToCompleted: (itemId: string) => void;
	removeCompletedItem: (itemId: string) => void;
	clearCompleted: () => void;
	getItem: (itemId: string) => QueueItem | undefined;
	getUserItem: (userId: string) => QueueItem | undefined;
	reset: () => void;

	// Internal helpers
	_cleanupSettlingTimer: (itemId: string) => void;
	_cleanupRevertingTimer: (itemId: string) => void;
	_createId: (event: LiveGiftMessage) => string;
	_calculateTier: (diamondCount: number) => PriorityTier;
	_reEvaluateQueue: () => void;
	_updatePositions: () => void;
	_calculateStats: () => QueueStats;
}

// ============================================================================
// Constants
// ============================================================================

export const SETTLING_DURATION = 5000; // 5 seconds
export const REVERTING_DURATION = 3000; // 3 seconds

let settlingTimers = new Map<string, NodeJS.Timeout>();
let revertingTimers = new Map<string, NodeJS.Timeout>();

// ============================================================================
// Store Implementation
// ============================================================================

export const useGiftQueueStore = create<GiftQueueStore>()(
	devtools(
		subscribeWithSelector(
			persist(
				immer((set, get) => ({
					// Initial state
					items: [],
					settlingTimers: new Map(),
					stats: {
						total: 0,
						waiting: 0,
						processing: 0,
						settling: 0,
						completed: 0,
						reverting: 0,
						byTier: {
							[PriorityTier.VIP]: 0,
							[PriorityTier.PREMIUM]: 0,
							[PriorityTier.STANDARD]: 0,
							[PriorityTier.FREE]: 0,
						},
					},

					// ====================================================================
					// Actions
					// ====================================================================

					addGiftToQueue: (event: LiveGiftMessage) => {
						const state = get();

						// Check if the item is already in the queue
						const existingItem = state.items.find(
							(item) => item.id === state._createId(event),
						);

						const tier = state._calculateTier(
							event.diamondCount * event.repeatCount,
						);
						const queueItem: QueueItem = {
							id: state._createId(event),
							tier,
							state: 'waiting',
							position: 0,
							createdAt: event.timestamp,
							gift: event,
						};

						let addedItem: QueueItem | null = null;

						if (existingItem) {
							// Replace existing item with new one
							set((draft: GiftQueueStore) => {
								const index = draft.items.findIndex(
									(item) => item.gift.groupId === event.groupId,
								);
								if (index !== -1) {
									draft.items[index] = queueItem;
									addedItem = queueItem;
								}
							});
						} else {
							// Add new item to queue
							set((draft: GiftQueueStore) => {
								draft.items.push(queueItem);
								addedItem = queueItem;
							});
						}

						// Re-evaluate after state update
						get()._reEvaluateQueue();

						return addedItem;
					},

					moveToWaiting: (itemId: string) => {
						const item = get().items.find((q) => q.id === itemId);
						if (!item) {
							throw new Error('Queue item not found');
						}

						set((draft: GiftQueueStore) => {
							const draftItem = draft.items.find((q) => q.id === itemId);
							if (draftItem) {
								draftItem.state = 'waiting';
								draftItem.settlingAt = undefined;
								draftItem.revertingAt = undefined;
							}
						});

						// Clear all timers related to this item
						get()._cleanupSettlingTimer(itemId);
						get()._cleanupRevertingTimer(itemId);

						get()._reEvaluateQueue();
					},

					moveToReverting: (itemId: string) => {
						const state = get();
						const item = state.items.find((q) => q.id === itemId);

						if (!item) {
							throw new Error('Queue item not found');
						}

						set((draft: GiftQueueStore) => {
							const draftItem = draft.items.find((q) => q.id === itemId);
							if (draftItem) {
								draftItem.state = 'reverting';
								draftItem.revertingAt = Date.now();
								draftItem.settlingAt = undefined;
							}
						});

						// Clear other timers
						get()._cleanupSettlingTimer(itemId);

						// Start reverting timer
						const timer = setTimeout(() => {
							get().moveToWaiting(itemId);
							revertingTimers.delete(itemId);
						}, REVERTING_DURATION);
						revertingTimers.set(itemId, timer);
					},

					cancelReverting: (itemId: string) => {
						const item = get().items.find((q) => q.id === itemId);

						if (!item || item.state !== 'reverting') {
							throw new Error('Can only cancel items in reverting state');
						}

						// Clear timer
						get()._cleanupRevertingTimer(itemId);

						get().moveToCompleted(itemId);
					},

					moveToSettling: (itemId: string) => {
						const item = get().items.find((q) => q.id === itemId);

						if (!item) {
							throw new Error('Queue item not found');
						}

						set((draft: GiftQueueStore) => {
							const draftItem = draft.items.find((q) => q.id === itemId);
							if (draftItem) {
								draftItem.state = 'settling';
								draftItem.settlingAt = Date.now();
								draftItem.revertingAt = undefined;
							}
						});

						// Clear other timers
						get()._cleanupRevertingTimer(itemId);

						// Start settling timer
						const timer = setTimeout(() => {
							get().moveToCompleted(itemId);
							settlingTimers.delete(itemId);
						}, SETTLING_DURATION);
						settlingTimers.set(itemId, timer);
					},

					cancelSettling: (itemId: string) => {
						const item = get().items.find((q) => q.id === itemId);

						if (!item || item.state !== 'settling') {
							throw new Error('Can only cancel items in settling state');
						}

						// Clear timer
						get()._cleanupSettlingTimer(itemId);

						get().moveToWaiting(itemId);
					},

					moveToCompleted: (itemId: string) => {
						set((draft: GiftQueueStore) => {
							const item = draft.items.find((q) => q.id === itemId);
							if (item) {
								item.state = 'completed';
								item.completedAt = Date.now();
								item.settlingAt = undefined;
								item.revertingAt = undefined;
							}
						});

						// Clear timers
						get()._cleanupSettlingTimer(itemId);
						get()._cleanupRevertingTimer(itemId);

						get()._reEvaluateQueue();
					},

					removeCompletedItem: (itemId: string) => {
						set((draft: GiftQueueStore) => {
							const index = draft.items.findIndex((q) => q.id === itemId);
							if (index !== -1 && draft.items[index]?.state === 'completed') {
								draft.items.splice(index, 1);
							}
						});
						get()._updatePositions();
					},

					clearCompleted: () => {
						set((draft: GiftQueueStore) => {
							draft.items = draft.items.filter(
								(item) => item.state !== 'completed',
							);
						});
						get()._updatePositions();
					},

					getItem: (itemId: string) => {
						return get().items.find((item) => item.id === itemId);
					},

					getUserItem: (userId: string) => {
						return get().items.find(
							(item) =>
								item.gift.userId === userId && item.state !== 'completed',
						);
					},

					reset: () => {
						settlingTimers.forEach((timer) => clearTimeout(timer));
						settlingTimers.clear();

						revertingTimers.forEach((timer) => clearTimeout(timer));
						revertingTimers.clear();

						set({
							items: [],
							stats: {
								total: 0,
								waiting: 0,
								processing: 0,
								settling: 0,
								completed: 0,
								reverting: 0,
								byTier: {
									[PriorityTier.VIP]: 0,
									[PriorityTier.PREMIUM]: 0,
									[PriorityTier.STANDARD]: 0,
									[PriorityTier.FREE]: 0,
								},
							},
						});
					},

					// ====================================================================
					// Internal Helpers
					// ====================================================================

					_cleanupSettlingTimer: (itemId: string) => {
						const timer = settlingTimers.get(itemId);
						if (timer) {
							clearTimeout(timer);
							settlingTimers.delete(itemId);
						}
					},

					_cleanupRevertingTimer: (itemId: string) => {
						const timer = revertingTimers.get(itemId);
						if (timer) {
							clearTimeout(timer);
							revertingTimers.delete(itemId);
						}
					},

					_createId: (event: LiveGiftMessage): string => {
						return `${event.groupId}:${event.giftId}:${event.userId}`;
					},

					_calculateTier: (diamondCount: number): PriorityTier => {
						if (diamondCount > 300) return PriorityTier.VIP;
						if (diamondCount >= 201) return PriorityTier.PREMIUM;
						if (diamondCount >= 2) return PriorityTier.STANDARD;
						return PriorityTier.FREE;
					},

					_reEvaluateQueue: () => {
						set((draft: GiftQueueStore) => {
							// Separate by state
							const completed = draft.items.filter(
								(i) => i.state === 'completed',
							);
							const working = draft.items.filter(
								(i) => i.state !== 'completed',
							);

							working.sort((a, b) => {
								// Skip reordering for active items (processing/settling)
								if (a.state !== 'waiting' || b.state !== 'waiting') return 0;
								if (a.tier !== b.tier) return a.tier - b.tier;
								return a.createdAt - b.createdAt;
							});

							draft.items = [...completed, ...working];
						});

						get()._updatePositions();
					},

					_updatePositions: () => {
						set((draft: GiftQueueStore) => {
							let positionCounter = 1;
							draft.items.forEach((item) => {
								if (item.state === 'completed') {
									item.position = 0; // Completed items don't need queue positions
								} else {
									item.position = positionCounter;
									positionCounter++;
								}
							});
						});

						// Update stats after position changes
						const stats = get()._calculateStats();
						set({ stats });
					},

					_calculateStats: (): QueueStats => {
						const items = get().items;

						const stats: QueueStats = {
							total: items.length,
							waiting: 0,
							processing: 0,
							settling: 0,
							completed: 0,
							reverting: 0,
							byTier: {
								[PriorityTier.VIP]: 0,
								[PriorityTier.PREMIUM]: 0,
								[PriorityTier.STANDARD]: 0,
								[PriorityTier.FREE]: 0,
							},
						};

						items.forEach((item) => {
							stats[item.state]++;
							stats.byTier[item.tier]++;
						});

						return stats;
					},
				})),
				{
					name: 'gift-queue-store',
					partialize: (state: GiftQueueStore) => ({
						items: state.items,
						stats: state.stats,
					}),
					onRehydrateStorage: () => (state) => {
						if (state) {
							// Initialize timers Map for rehydrated state
							settlingTimers = new Map();
							revertingTimers = new Map();

							// Immediately move transitioning items to their final states
							state.items.forEach((item) => {
								if (item.state === 'settling') {
									state.moveToCompleted(item.id);
								} else if (item.state === 'reverting') {
									state.moveToWaiting(item.id);
								}
							});
						}
					},
				},
			),
		),
		{ name: 'QueueStore' },
	),
);

// ============================================================================
// Selectors (optimized)
// ============================================================================

export const giftQueueSelectors = {
	// Get all items
	items: (state: GiftQueueStore) => state.items,

	// Get waiting items only
	waitingItems: (state: GiftQueueStore) =>
		state.items.filter((item) => item.state === 'waiting'),

	// Get settling item
	settlingItem: (state: GiftQueueStore) =>
		state.items.find((item) => item.state === 'settling'),

	// Get completed items
	completedItems: (state: GiftQueueStore) =>
		state.items.filter((item) => item.state === 'completed'),

	// Get stats
	stats: (state: GiftQueueStore) => state.stats,

	// Get next in line
	nextInLine: (state: GiftQueueStore) =>
		state.items.find((item) => item.state === 'waiting'),

	// Check if user is in queue
	isUserInQueue: (userId: string) => (state: GiftQueueStore) =>
		state.items.some(
			(item) => item.gift.userId === userId && item.state !== 'completed',
		),
};
