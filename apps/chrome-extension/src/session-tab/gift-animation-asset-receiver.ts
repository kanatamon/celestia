/// <reference types="chrome" />

import {
	type GiftAnimationAssetCapturedMessage,
	isGiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';

/**
 * Subscribes the Session Tab to routed Gift Animation Assets (ADR-0006). The
 * service worker delivers captured bytes here via `chrome.tabs.sendMessage`.
 * Bytes stay in-memory — this slice proves the pipe; the Gift Celebration
 * rendering is wired in a later slice. Returns an unsubscribe.
 */
export function subscribeGiftAnimationAssets(
	onAsset: (asset: GiftAnimationAssetCapturedMessage) => void,
	runtime: typeof chrome.runtime | undefined = typeof chrome === 'undefined'
		? undefined
		: chrome.runtime,
): () => void {
	if (!runtime?.onMessage) {
		return () => {};
	}

	const listener = (message: unknown): undefined => {
		if (isGiftAnimationAssetCapturedMessage(message)) {
			onAsset(message);
		}
		return undefined;
	};

	runtime.onMessage.addListener(listener);
	return () => runtime.onMessage.removeListener(listener);
}

/** Whether an MP4 `ArrayBuffer` carries a valid `ftyp` box (offset 4, 'ftyp'). */
export function isFtypValidMp4(bytes: ArrayBuffer): boolean {
	if (bytes.byteLength < 8) {
		return false;
	}
	const view = new Uint8Array(bytes, 4, 4);
	return (
		view[0] === 0x66 && // 'f'
		view[1] === 0x74 && // 't'
		view[2] === 0x79 && // 'y'
		view[3] === 0x70 // 'p'
	);
}
