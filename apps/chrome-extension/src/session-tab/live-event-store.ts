/// <reference types="chrome" />

import type {
	ChatLiveEvent,
	ConnectionState,
	GiftLiveEvent,
	LikeLiveEvent,
	MemberLiveEvent,
	ViewerCountLiveEvent,
} from '@celestia/tiktok-live-core';
import { create } from 'zustand';
import { createJSONStorage, type PersistStorage, persist } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';

const MAX_CHAT_EVENTS = 1000;
const MAX_GIFT_EVENTS = 100;
const MAX_MEMBER_EVENTS = 100;
const STORE_NAME = 'celestia-live-event-store';
const SERIALIZED_MAP_TYPE = 'Map';

export type LiveChatEvent = ChatLiveEvent;
export type LiveGiftEvent = GiftLiveEvent;
export type LiveMemberEvent = MemberLiveEvent;

export interface LiveEventStore {
	connectionState: ConnectionState;
	streamerUsername: string | null;
	viewerCount: number;
	likeCount: number;
	chatEvents: LiveChatEvent[];
	giftEvents: LiveGiftEvent[];
	memberEvents: LiveMemberEvent[];
	userGiftEvents: Map<string, LiveGiftEvent[]>;
	addChatEvent: (event: LiveChatEvent) => void;
	addGiftEvent: (event: LiveGiftEvent) => void;
	addMemberEvent: (event: LiveMemberEvent) => void;
	updateViewerCount: (event: ViewerCountLiveEvent | number) => void;
	updateLikeCount: (event: LikeLiveEvent) => void;
	setConnectionState: (connectionState: ConnectionState) => void;
	setStreamerUsername: (streamerUsername: string | null) => void;
	resetSession: () => void;
}

type LiveEventStorePersistedState = Omit<
	LiveEventStore,
	| 'addChatEvent'
	| 'addGiftEvent'
	| 'addMemberEvent'
	| 'updateViewerCount'
	| 'updateLikeCount'
	| 'setConnectionState'
	| 'setStreamerUsername'
	| 'resetSession'
>;

type LiveEventStoreApi = StoreApi<LiveEventStore> & {
	persist: {
		rehydrate: () => Promise<void> | void;
	};
};

interface ChromeSessionStorageArea {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(key: string): Promise<void>;
}

interface CreateLiveEventStoreOptions {
	storage?: PersistStorage<LiveEventStorePersistedState, Promise<void>>;
	name?: string;
}

const initialPersistedState: LiveEventStorePersistedState = {
	connectionState: { status: 'idle', username: '' },
	streamerUsername: null,
	viewerCount: 0,
	likeCount: 0,
	chatEvents: [],
	giftEvents: [],
	memberEvents: [],
	userGiftEvents: new Map(),
};

export const useLiveEventStore = create<LiveEventStore>()(
	liveEventStoreInitializer(createSessionStorage()),
);

export function createLiveEventStore({
	storage = createSessionStorage(),
	name = STORE_NAME,
}: CreateLiveEventStoreOptions = {}): LiveEventStoreApi {
	return createStore<LiveEventStore>()(
		liveEventStoreInitializer(storage, name),
	) as LiveEventStoreApi;
}

export function createSessionStorage(
	storageArea = getChromeSessionStorageArea(),
): PersistStorage<LiveEventStorePersistedState, Promise<void>> {
	return createJSONStorage<LiveEventStorePersistedState, Promise<void>>(
		() => ({
			async getItem(name) {
				const values = await storageArea.get(name);
				const value = values[name];

				return typeof value === 'string' ? value : null;
			},
			async setItem(name, value) {
				await storageArea.set({ [name]: value });
			},
			async removeItem(name) {
				await storageArea.remove(name);
			},
		}),
		{
			replacer: (_key, value) => {
				if (value instanceof Map) {
					return {
						__celestiaType: SERIALIZED_MAP_TYPE,
						value: Array.from(value.entries()),
					};
				}

				return value;
			},
			reviver: (_key, value) => {
				if (isSerializedMap(value)) {
					return new Map(value.value);
				}

				return value;
			},
		},
	) as PersistStorage<LiveEventStorePersistedState, Promise<void>>;
}

function liveEventStoreInitializer(
	storage: PersistStorage<LiveEventStorePersistedState, Promise<void>>,
	name: string = STORE_NAME,
) {
	return persist<LiveEventStore, [], [], LiveEventStorePersistedState>(
		(set) => ({
			...createInitialPersistedState(),
			addChatEvent: (event) => {
				if (!event.text.trim()) return;
				set((state) => ({
					chatEvents: appendCapped(state.chatEvents, event, MAX_CHAT_EVENTS),
				}));
			},
			addGiftEvent: (event) => {
				set((state) => {
					const giftEvents = dedupeGiftEvents([...state.giftEvents, event]).slice(-MAX_GIFT_EVENTS);
					const userGiftEvents = new Map(state.userGiftEvents);
					const userId = getGiftUserId(event);

					if (userId) {
						userGiftEvents.set(userId, [...(userGiftEvents.get(userId) ?? []), event]);
					}

					return { giftEvents, userGiftEvents };
				});
			},
			addMemberEvent: (event) => {
				set((state) => ({
					memberEvents: appendCapped(state.memberEvents, event, MAX_MEMBER_EVENTS),
				}));
			},
			updateViewerCount: (event) => {
				set({ viewerCount: typeof event === 'number' ? event : event.viewerCount });
			},
			updateLikeCount: (event) => {
				set((state) => ({
					likeCount: event.totalLikeCount ?? state.likeCount + Math.max(event.likeCount ?? 0, 0),
				}));
			},
			setConnectionState: (connectionState) => {
				set({ connectionState });
			},
			setStreamerUsername: (streamerUsername) => {
				set({ streamerUsername });
			},
			resetSession: () => {
				set({
					viewerCount: 0,
					likeCount: 0,
					chatEvents: [],
					giftEvents: [],
					memberEvents: [],
					userGiftEvents: new Map(),
				});
			},
		}),
		{
			name,
			storage,
			partialize: pickPersistedState,
			merge: mergePersistedState,
		},
	);
}

function createInitialPersistedState(): LiveEventStorePersistedState {
	return {
		...initialPersistedState,
		chatEvents: [],
		giftEvents: [],
		memberEvents: [],
		userGiftEvents: new Map(),
	};
}

function pickPersistedState(state: LiveEventStore): LiveEventStorePersistedState {
	return {
		connectionState: state.connectionState,
		streamerUsername: state.streamerUsername,
		viewerCount: state.viewerCount,
		likeCount: state.likeCount,
		chatEvents: state.chatEvents,
		giftEvents: state.giftEvents,
		memberEvents: state.memberEvents,
		userGiftEvents: state.userGiftEvents,
	};
}

function mergePersistedState(
	persistedState: unknown,
	currentState: LiveEventStore,
): LiveEventStore {
	const persisted = toPersistedState(persistedState);

	return {
		...currentState,
		...persisted,
		userGiftEvents: toGiftEventMap(persisted.userGiftEvents),
	};
}

function toPersistedState(value: unknown): Partial<LiveEventStorePersistedState> {
	return isObject(value) ? value : {};
}

function appendCapped<T>(items: T[], item: T, limit: number): T[] {
	return [...items, item].slice(-limit);
}

function dedupeGiftEvents(events: LiveGiftEvent[]): LiveGiftEvent[] {
	const seenGroupIds = new Set<string>();
	const deduped: LiveGiftEvent[] = [];

	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];

		if (!event) {
			continue;
		}

		if (event.groupId) {
			if (seenGroupIds.has(event.groupId)) {
				continue;
			}

			seenGroupIds.add(event.groupId);
		}

		deduped.unshift(event);
	}

	return deduped;
}

function getGiftUserId(event: LiveGiftEvent): string | undefined {
	return event.user?.userId ?? event.user?.uniqueId ?? event.user?.secUid;
}

function toGiftEventMap(value: unknown): Map<string, LiveGiftEvent[]> {
	if (value instanceof Map) {
		return value;
	}

	return new Map();
}

function getChromeSessionStorageArea(): ChromeSessionStorageArea {
	const sessionStorageArea = typeof chrome === 'undefined' ? undefined : chrome.storage?.session;

	return sessionStorageArea ?? createMemorySessionStorageArea();
}

function createMemorySessionStorageArea(): ChromeSessionStorageArea {
	const values = new Map<string, unknown>();

	return {
		async get(key) {
			return { [key]: values.get(key) };
		},
		async set(items) {
			for (const [key, value] of Object.entries(items)) {
				values.set(key, value);
			}
		},
		async remove(key) {
			values.delete(key);
		},
	};
}

function isSerializedMap(
	value: unknown,
): value is { __celestiaType: typeof SERIALIZED_MAP_TYPE; value: [string, LiveGiftEvent[]][] } {
	return (
		isObject(value) &&
		'__celestiaType' in value &&
		value.__celestiaType === SERIALIZED_MAP_TYPE &&
		'value' in value &&
		Array.isArray(value.value)
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
