import {
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGiftAssetRouter } from '../src/background/gift-asset-router.js';
import { createTabPairingRegistry, type TabPair } from '../src/background/tab-pairing-registry.js';

const TIKTOK_TAB_ID = 11;
const SESSION_TAB_ID = 22;

function capturedMessage(): GiftAnimationAssetCapturedMessage {
	return {
		type: GIFT_ANIMATION_ASSET_CAPTURED,
		mimeType: 'video/mp4',
		bytes: new Uint8Array([0, 0, 0, 24]).buffer,
	};
}

describe('gift asset router', () => {
	let storageArea: FakeChromeSessionStorageArea;
	let tabs: FakeTabMessenger;

	beforeEach(() => {
		storageArea = new FakeChromeSessionStorageArea();
		tabs = new FakeTabMessenger();
	});

	async function createRouter(pair?: TabPair) {
		const registry = createTabPairingRegistry(storageArea);
		if (pair) {
			await registry.setPair(pair);
		}
		return createGiftAssetRouter({ registry, tabs });
	}

	it('routes captured bytes to the Session Tab paired to the originating TikTok tab', async () => {
		const router = await createRouter({
			tiktokTabId: TIKTOK_TAB_ID,
			sessionTabId: SESSION_TAB_ID,
		});

		const routed = await router.route(capturedMessage(), TIKTOK_TAB_ID);

		expect(routed).toBe(true);
		expect(tabs.sent).toHaveLength(1);
		expect(tabs.sent[0]?.tabId).toBe(SESSION_TAB_ID);
		expect(tabs.sent[0]?.message.type).toBe(GIFT_ANIMATION_ASSET_CAPTURED);
		expect(tabs.sent[0]?.message.mimeType).toBe('video/mp4');
	});

	it('drops the asset when the originating TikTok tab is not paired', async () => {
		const router = await createRouter();

		const routed = await router.route(capturedMessage(), TIKTOK_TAB_ID);

		expect(routed).toBe(false);
		expect(tabs.sent).toHaveLength(0);
	});

	it('ignores non-capture messages', async () => {
		const router = await createRouter({
			tiktokTabId: TIKTOK_TAB_ID,
			sessionTabId: SESSION_TAB_ID,
		});

		const routed = await router.route({ type: 'OPEN_LIVE_SESSION' }, TIKTOK_TAB_ID);

		expect(routed).toBe(false);
		expect(tabs.sent).toHaveLength(0);
	});

	it('drops the asset when the sender tab id is missing', async () => {
		const router = await createRouter({
			tiktokTabId: TIKTOK_TAB_ID,
			sessionTabId: SESSION_TAB_ID,
		});

		const routed = await router.route(capturedMessage(), undefined);

		expect(routed).toBe(false);
		expect(tabs.sent).toHaveLength(0);
	});

	it('does not route to a Session Tab paired to a different TikTok tab', async () => {
		const router = await createRouter({
			tiktokTabId: TIKTOK_TAB_ID,
			sessionTabId: SESSION_TAB_ID,
		});

		const routed = await router.route(capturedMessage(), 999);

		expect(routed).toBe(false);
		expect(tabs.sent).toHaveLength(0);
	});
});

class FakeTabMessenger {
	sent: { tabId: number; message: GiftAnimationAssetCapturedMessage }[] = [];

	async sendMessage(tabId: number, message: GiftAnimationAssetCapturedMessage): Promise<unknown> {
		this.sent.push({ tabId, message });
		return undefined;
	}
}

class FakeChromeSessionStorageArea {
	private readonly values = new Map<string, unknown>();

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
