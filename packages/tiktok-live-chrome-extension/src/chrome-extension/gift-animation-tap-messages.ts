/**
 * Wire contract for the Gift Animation Tap (ADR-0006). Three hops carry the
 * decrypted Gift Animation Asset from the paired TikTok tab to the Session Tab:
 *
 *   MAIN-world page tap  --window.postMessage-->  isolated content script
 *   isolated content script  --chrome.runtime-->  service worker
 *   service worker  --chrome.tabs.sendMessage-->  paired Session Tab
 *
 * Only the first hop is structured-clone: `window.postMessage` carries the raw
 * `ArrayBuffer` (transferred). The two `chrome.runtime`/`chrome.tabs` hops are
 * **JSON-serialized** — an `ArrayBuffer` would silently flatten to `{}` and be
 * dropped by the type guard. So across those hops the bytes ride as a base64
 * `string` ({@link arrayBufferToBase64} / {@link base64ToArrayBuffer}). Nothing
 * is persisted.
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
 * Both hops are JSON-serialized, so the asset bytes travel as a base64 `string`,
 * not an `ArrayBuffer` (which would not survive the serialization). The Session
 * Tab decodes it back to bytes via {@link base64ToArrayBuffer}.
 */
export interface GiftAnimationAssetCapturedMessage {
	type: typeof GIFT_ANIMATION_ASSET_CAPTURED;
	mimeType: string;
	bytesBase64: string;
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
		typeof candidate.bytesBase64 === 'string'
	);
}

/**
 * Encode an `ArrayBuffer` as a base64 `string` so it survives the JSON-only
 * `chrome.runtime`/`chrome.tabs` messaging hops. Chunked so a multi-megabyte MP4
 * does not blow the call stack via `String.fromCharCode(...spread)`.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const CHUNK = 0x8000;
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** Decode a base64 `string` produced by {@link arrayBufferToBase64} back to bytes. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
