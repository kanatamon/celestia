import type {
	ChatLiveEvent,
	LikeLiveEvent,
	MemberLiveEvent,
	ViewerCountLiveEvent,
} from '@celestia/tiktok-live-core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createLiveEventStore,
	createSessionStorage,
	type LiveGiftEvent,
} from '../src/side-panel/live-event-store.js';

describe('live event store', () => {
	let storageArea: FakeChromeSessionStorageArea;

	beforeEach(() => {
		storageArea = new FakeChromeSessionStorageArea();
	});

	it('tracks live session events, caps arrays, and resets counters without resetting live context', async () => {
		const store = createLiveEventStore({
			storage: createSessionStorage(storageArea),
		});
		await store.persist.rehydrate();

		store.getState().setStreamerUsername('celestia');
		store.getState().setConnectionState({ status: 'connected', username: 'celestia' });
		store.getState().updateLikeCount(likeEvent('like-1', { likeCount: 3 }));
		store.getState().updateLikeCount(likeEvent('like-2', { likeCount: 7 }));
		store.getState().updateLikeCount(likeEvent('like-3', { likeCount: 4, totalLikeCount: 100 }));
		store.getState().updateViewerCount(viewerCountEvent(42));

		for (let index = 0; index < 1005; index += 1) {
			store.getState().addChatEvent(chatEvent(`chat-${index}`));
		}

		for (let index = 0; index < 105; index += 1) {
			store.getState().addMemberEvent(memberEvent(`member-${index}`));
		}

		expect(store.getState().likeCount).toBe(100);
		expect(store.getState().viewerCount).toBe(42);
		expect(store.getState().chatEvents).toHaveLength(1000);
		expect(store.getState().chatEvents[0]?.id).toBe('chat-5');
		expect(store.getState().memberEvents).toHaveLength(100);
		expect(store.getState().memberEvents[0]?.id).toBe('member-5');

		store.getState().resetSession();

		expect(store.getState().connectionState.status).toBe('connected');
		expect(store.getState().streamerUsername).toBe('celestia');
		expect(store.getState().viewerCount).toBe(0);
		expect(store.getState().likeCount).toBe(0);
		expect(store.getState().chatEvents).toEqual([]);
		expect(store.getState().memberEvents).toEqual([]);
	});

	it('ignores chat events with empty or whitespace-only text', async () => {
		const store = createLiveEventStore({
			storage: createSessionStorage(storageArea),
		});
		await store.persist.rehydrate();

		store.getState().addChatEvent(chatEvent('chat-1'));
		store.getState().addChatEvent({ ...chatEvent('chat-2'), text: '' });
		store.getState().addChatEvent({ ...chatEvent('chat-3'), text: '   ' });

		expect(store.getState().chatEvents.map((e) => e.id)).toEqual(['chat-1']);
	});

	it('deduplicates gifts by groupId and keeps per-user gift history', async () => {
		const store = createLiveEventStore({
			storage: createSessionStorage(storageArea),
		});
		await store.persist.rehydrate();

		store.getState().addGiftEvent(giftEvent('gift-1', 'group-1', 'user-1', 1));
		store.getState().addGiftEvent(giftEvent('gift-2', 'group-1', 'user-1', 5));
		store.getState().addGiftEvent(giftEvent('gift-3', 'group-2', 'user-2', 1));

		expect(store.getState().giftEvents.map((event) => event.id)).toEqual(['gift-2', 'gift-3']);
		expect(
			store
				.getState()
				.userGiftEvents.get('user-1')
				?.map((event) => event.id),
		).toEqual(['gift-1', 'gift-2']);
		expect(
			store
				.getState()
				.userGiftEvents.get('user-2')
				?.map((event) => event.id),
		).toEqual(['gift-3']);
	});

	it('persists full state to chrome.storage.session and restores userGiftEvents as a Map', async () => {
		const firstStore = createLiveEventStore({
			storage: createSessionStorage(storageArea),
		});
		await firstStore.persist.rehydrate();

		firstStore.getState().setStreamerUsername('celestia');
		firstStore.getState().setConnectionState({ status: 'connected', username: 'celestia' });
		firstStore.getState().addChatEvent(chatEvent('chat-1'));
		firstStore.getState().addGiftEvent(giftEvent('gift-1', 'group-1', 'user-1', 2));
		firstStore.getState().addMemberEvent(memberEvent('member-1'));
		firstStore.getState().updateViewerCount(viewerCountEvent(12));
		firstStore.getState().updateLikeCount(likeEvent('like-1', { totalLikeCount: 50 }));

		await Promise.resolve();

		const secondStore = createLiveEventStore({
			storage: createSessionStorage(storageArea),
		});
		await secondStore.persist.rehydrate();

		expect(secondStore.getState().streamerUsername).toBe('celestia');
		expect(secondStore.getState().connectionState.status).toBe('connected');
		expect(secondStore.getState().chatEvents).toHaveLength(1);
		expect(secondStore.getState().giftEvents).toHaveLength(1);
		expect(secondStore.getState().memberEvents).toHaveLength(1);
		expect(secondStore.getState().viewerCount).toBe(12);
		expect(secondStore.getState().likeCount).toBe(50);
		expect(secondStore.getState().userGiftEvents).toBeInstanceOf(Map);
		expect(secondStore.getState().userGiftEvents.get('user-1')?.[0]?.id).toBe('gift-1');
	});
});

class FakeChromeSessionStorageArea {
	readonly values = new Map<string, unknown>();

	async get(key: string): Promise<Record<string, unknown>> {
		return { [key]: this.values.get(key) };
	}

	async set(items: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(items)) {
			this.values.set(key, value);
		}
	}

	async remove(key: string): Promise<void> {
		this.values.delete(key);
	}
}

function chatEvent(id: string): ChatLiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'chat',
		source: 'test',
		text: `message ${id}`,
	};
}

function giftEvent(
	id: string,
	groupId: string,
	userId: string,
	repeatCount: number,
): LiveGiftEvent {
	return {
		id,
		ts: Date.now(),
		type: 'gift',
		source: 'test',
		groupId,
		repeatCount,
		user: { userId, uniqueId: userId },
	};
}

function memberEvent(id: string): MemberLiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'member',
		source: 'test',
	};
}

function viewerCountEvent(viewerCount: number): ViewerCountLiveEvent {
	return {
		id: `viewer-${viewerCount}`,
		ts: Date.now(),
		type: 'viewer_count' as const,
		source: 'test',
		viewerCount,
	};
}

function likeEvent(
	id: string,
	counts: { likeCount?: number; totalLikeCount?: number },
): LikeLiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'like',
		source: 'test',
		...counts,
	};
}
