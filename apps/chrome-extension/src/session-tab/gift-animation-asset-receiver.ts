/// <reference types="chrome" />

import {
	base64ToArrayBuffer,
	type GiftAnimationAssetCapturedMessage,
	isGiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import type { AnimatedCapturedCelebration } from '@celestia/ui';

/**
 * Subscribes the Session Tab to routed Gift Animation Assets (ADR-0006). The
 * service worker delivers captured bytes here via `chrome.tabs.sendMessage`.
 * Bytes stay in-memory: each delivery is paired into a `CapturedCelebration`
 * (see `toCapturedCelebration`) and enqueued for playback. Returns an
 * unsubscribe.
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

/**
 * Mints a Session-Tab object URL for a captured Gift Animation Asset and pairs
 * it with a content-derived `assetId`, ready to enqueue into the celebration
 * queue (ADR-0005 §4). The URL is minted **in the Session Tab context** from the
 * delivered `ArrayBuffer`; `CelebrationStage` owns its lifecycle and revokes it
 * on clip end or drop. Because the same gift yields byte-identical bytes, the
 * content fingerprint lets a burst of one gift coalesce into a single play.
 */
export function toCapturedCelebration(
	asset: GiftAnimationAssetCapturedMessage,
): AnimatedCapturedCelebration {
	// The bytes crossed the chrome messaging hops as base64; decode them back here,
	// in the Session Tab context, before minting the object URL.
	const bytes = base64ToArrayBuffer(asset.bytesBase64);
	const blob = new Blob([bytes], { type: asset.mimeType || 'video/mp4' });
	return {
		kind: 'animated',
		assetId: fingerprintBytes(bytes),
		assetUrl: URL.createObjectURL(blob),
	};
}

/**
 * A fast content fingerprint of an asset's bytes. Identical clips fingerprint
 * identically (so the queue coalesces them); distinct clips collide only
 * astronomically rarely. Folds the byte length with an FNV-1a hash over the
 * head, tail, and evenly-spaced samples so a multi-megabyte MP4 fingerprints in
 * constant time without scanning every byte.
 */
function fingerprintBytes(bytes: ArrayBuffer): string {
	const view = new Uint8Array(bytes);
	const length = view.byteLength;
	let hash = 0x811c9dc5;
	const fold = (byte: number) => {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	};

	// Fold the length so same-content / different-length never collide.
	fold(length & 0xff);
	fold((length >>> 8) & 0xff);
	fold((length >>> 16) & 0xff);
	fold((length >>> 24) & 0xff);

	const sampleCount = Math.min(length, 4096);
	for (let i = 0; i < sampleCount; i += 1) {
		const index = Math.floor((i * length) / sampleCount);
		fold(view[index] ?? 0);
	}

	return `gift-asset-${(hash >>> 0).toString(16)}-${length.toString(16)}`;
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
