/// <reference types="chrome" />

/**
 * Gift Animation Tap — isolated-world relay (ADR-0006). Listens for the
 * `window.postMessage` bridge from the MAIN-world tap and relays captured bytes
 * to the service worker over `chrome.runtime`. This world has `chrome.*`; the
 * MAIN world does not, which is why the hop exists. Nothing is retained here.
 */

import {
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
	isGiftAnimationTapBridgeMessage,
} from './gift-animation-tap-messages.js';

interface RuntimeMessenger {
	sendMessage(message: unknown): void;
}

export function installGiftAnimationTapRelay(
	target: Window = window,
	runtime: RuntimeMessenger | undefined = typeof chrome === 'undefined'
		? undefined
		: chrome.runtime,
): void {
	if (!runtime) {
		return;
	}

	target.addEventListener('message', (event: MessageEvent) => {
		// Only trust messages this document posted to itself (the MAIN-world tap).
		if (event.source !== target || event.origin !== target.location.origin) {
			return;
		}
		if (!isGiftAnimationTapBridgeMessage(event.data)) {
			return;
		}

		const message: GiftAnimationAssetCapturedMessage = {
			type: GIFT_ANIMATION_ASSET_CAPTURED,
			mimeType: event.data.mimeType,
			bytes: event.data.bytes,
		};

		try {
			runtime.sendMessage(message);
		} catch {
			// The service worker may be momentarily unavailable; the next capture
			// re-attempts. The Tap never persists or queues bytes.
		}
	});
}
