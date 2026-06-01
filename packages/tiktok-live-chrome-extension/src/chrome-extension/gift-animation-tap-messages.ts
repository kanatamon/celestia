/**
 * Wire contract for the Gift Animation Tap (ADR-0006). Three hops carry the
 * decrypted Gift Animation Asset from the paired TikTok tab to the Session Tab:
 *
 *   MAIN-world page tap  --window.postMessage-->  isolated content script
 *   isolated content script  --chrome.runtime-->  service worker
 *   service worker  --chrome.tabs.sendMessage-->  paired Session Tab
 *
 * The bytes ride as a structured-cloned `ArrayBuffer`; nothing is persisted.
 */

/** `window.postMessage` channel tag bridging MAIN world → isolated world. */
export const GIFT_ANIMATION_TAP_SOURCE = 'celestia-gift-animation-tap';

/** `chrome.runtime`/`chrome.tabs` message type for a captured Gift Animation Asset. */
export const GIFT_ANIMATION_ASSET_CAPTURED = 'CELESTIA_GIFT_ANIMATION_ASSET_CAPTURED';

/**
 * The MAIN-world tap → isolated content script bridge message, posted via
 * `window.postMessage`. The `source` tag namespaces it away from TikTok's own
 * page messages.
 */
export interface GiftAnimationTapBridgeMessage {
	source: typeof GIFT_ANIMATION_TAP_SOURCE;
	mimeType: string;
	bytes: ArrayBuffer;
}

/**
 * The captured-asset message relayed over `chrome.runtime` (content script →
 * service worker) and `chrome.tabs.sendMessage` (service worker → Session Tab).
 */
export interface GiftAnimationAssetCapturedMessage {
	type: typeof GIFT_ANIMATION_ASSET_CAPTURED;
	mimeType: string;
	bytes: ArrayBuffer;
}

export function isGiftAnimationTapBridgeMessage(
	value: unknown,
): value is GiftAnimationTapBridgeMessage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		candidate.source === GIFT_ANIMATION_TAP_SOURCE &&
		typeof candidate.mimeType === 'string' &&
		candidate.bytes instanceof ArrayBuffer
	);
}

export function isGiftAnimationAssetCapturedMessage(
	value: unknown,
): value is GiftAnimationAssetCapturedMessage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		candidate.type === GIFT_ANIMATION_ASSET_CAPTURED &&
		typeof candidate.mimeType === 'string' &&
		candidate.bytes instanceof ArrayBuffer
	);
}
