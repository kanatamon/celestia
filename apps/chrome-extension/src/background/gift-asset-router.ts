/// <reference types="chrome" />

import {
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
	isGiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import type { TabPairingRegistry } from './tab-pairing-registry.js';

interface TabMessenger {
	sendMessage(tabId: number, message: GiftAnimationAssetCapturedMessage): Promise<unknown>;
}

interface CreateGiftAssetRouterOptions {
	registry: TabPairingRegistry;
	tabs: TabMessenger;
}

/**
 * Routes captured Gift Animation Assets (ADR-0006) from a paired TikTok tab to
 * its Session Tab. The originating TikTok tab is `sender.tab.id`; the Tab
 * Pairing Registry resolves the destination Session Tab. Bytes are forwarded
 * in-memory only — nothing is written to persistent storage. If the TikTok tab
 * is not paired (closed/unpaired), the asset is dropped: the Tap is only active
 * while paired, so unpaired captures must never reach a Session Tab.
 */
export interface GiftAssetRouter {
	route(message: unknown, senderTabId: number | undefined): Promise<boolean>;
}

export function createGiftAssetRouter({
	registry,
	tabs,
}: CreateGiftAssetRouterOptions): GiftAssetRouter {
	return {
		async route(message, senderTabId) {
			if (!isGiftAnimationAssetCapturedMessage(message) || typeof senderTabId !== 'number') {
				return false;
			}

			const sessionTabId = await registry.getSessionTabId(senderTabId);
			if (sessionTabId === null) {
				return false;
			}

			const forwarded: GiftAnimationAssetCapturedMessage = {
				type: GIFT_ANIMATION_ASSET_CAPTURED,
				mimeType: message.mimeType,
				bytes: message.bytes,
			};

			try {
				await tabs.sendMessage(sessionTabId, forwarded);
			} catch {
				// The Session Tab may have just closed; the asset is simply dropped.
				return false;
			}

			return true;
		},
	};
}
