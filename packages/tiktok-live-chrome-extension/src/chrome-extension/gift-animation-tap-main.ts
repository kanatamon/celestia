/**
 * Gift Animation Tap — page side (ADR-0006). A `world: MAIN` content script
 * injected at `document_start` so it patches the page globals before TikTok's
 * own code runs.
 *
 * It hooks `Worker.prototype.postMessage` to **arm** on the gift-decrypt message
 * and `URL.createObjectURL` to **capture** the next `video/mp4` blob TikTok mints
 * from the worker's plaintext output. The arm/capture decision is delegated to
 * the pure {@link reduceGiftAssetFilter}. Captured bytes are bridged to the
 * isolated-world content script via `window.postMessage` (the MAIN world has no
 * `chrome.*`). Nothing is retained after forwarding.
 */

import {
	GIFT_ANIMATION_TAP_SOURCE,
	type GiftAnimationTapBridgeMessage,
} from './gift-animation-tap-messages.js';
import {
	type GiftAssetArmState,
	initialArmState,
	reduceGiftAssetFilter,
} from './gift-asset-arm-filter.js';

export function installGiftAnimationTap(target: Window & typeof globalThis = window): void {
	const WorkerCtor = target.Worker;
	const urlCtor = target.URL;
	if (!WorkerCtor?.prototype || !urlCtor?.createObjectURL) {
		return;
	}

	let armState: GiftAssetArmState = initialArmState;

	const originalPostMessage = WorkerCtor.prototype.postMessage;
	function patchedPostMessage(this: Worker, ...args: unknown[]): void {
		try {
			const result = reduceGiftAssetFilter(armState, {
				kind: 'workerMessage',
				payload: args[0],
			});
			armState = result.state;
		} catch {
			// Never let the tap break TikTok's own worker messaging.
		}
		(originalPostMessage as (...a: unknown[]) => void).apply(this, args);
	}
	WorkerCtor.prototype.postMessage = patchedPostMessage as Worker['postMessage'];

	const originalCreateObjectURL = urlCtor.createObjectURL.bind(urlCtor);
	urlCtor.createObjectURL = (source: Blob | MediaSource): string => {
		const objectUrl = originalCreateObjectURL(source);
		try {
			const mimeType = source instanceof Blob ? source.type : '';
			const result = reduceGiftAssetFilter(armState, { kind: 'objectCreated', mimeType });
			armState = result.state;
			if (result.decision === 'capture' && source instanceof Blob) {
				void forwardCapturedAsset(target, source, mimeType);
			}
		} catch {
			// Capture failures must not affect the page's own object-URL usage.
		}
		return objectUrl;
	};
}

async function forwardCapturedAsset(target: Window, blob: Blob, mimeType: string): Promise<void> {
	const bytes = await blob.arrayBuffer();
	const message: GiftAnimationTapBridgeMessage = {
		source: GIFT_ANIMATION_TAP_SOURCE,
		mimeType,
		bytes,
	};
	target.postMessage(message, target.location.origin, [bytes]);
}
