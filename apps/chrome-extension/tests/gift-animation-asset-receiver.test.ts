import {
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import { describe, expect, it, vi } from 'vitest';
import {
	isFtypValidMp4,
	subscribeGiftAnimationAssets,
} from '../src/session-tab/gift-animation-asset-receiver.js';

function ftypMp4(): ArrayBuffer {
	// size (4 bytes) + 'ftyp' + brand
	return new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).buffer;
}

function capturedMessage(): GiftAnimationAssetCapturedMessage {
	return { type: GIFT_ANIMATION_ASSET_CAPTURED, mimeType: 'video/mp4', bytes: ftypMp4() };
}

class FakeRuntimeOnMessage {
	listeners: Array<(message: unknown) => void> = [];
	onMessage = {
		addListener: (listener: (message: unknown) => void) => this.listeners.push(listener),
		removeListener: (listener: (message: unknown) => void) => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		},
	};
	emit(message: unknown) {
		for (const listener of this.listeners) listener(message);
	}
}

describe('gift animation asset receiver', () => {
	it('delivers captured assets to the handler', () => {
		const runtime = new FakeRuntimeOnMessage();
		const onAsset = vi.fn();

		subscribeGiftAnimationAssets(onAsset, runtime as unknown as typeof chrome.runtime);
		runtime.emit(capturedMessage());

		expect(onAsset).toHaveBeenCalledTimes(1);
	});

	it('ignores unrelated runtime messages', () => {
		const runtime = new FakeRuntimeOnMessage();
		const onAsset = vi.fn();

		subscribeGiftAnimationAssets(onAsset, runtime as unknown as typeof chrome.runtime);
		runtime.emit({ type: 'OPEN_LIVE_SESSION' });

		expect(onAsset).not.toHaveBeenCalled();
	});

	it('unsubscribes', () => {
		const runtime = new FakeRuntimeOnMessage();
		const onAsset = vi.fn();

		const unsubscribe = subscribeGiftAnimationAssets(
			onAsset,
			runtime as unknown as typeof chrome.runtime,
		);
		unsubscribe();
		runtime.emit(capturedMessage());

		expect(onAsset).not.toHaveBeenCalled();
	});

	it('recognises an ftyp-valid MP4 buffer', () => {
		expect(isFtypValidMp4(ftypMp4())).toBe(true);
	});

	it('rejects buffers without an ftyp box', () => {
		expect(isFtypValidMp4(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)).toBe(false);
		expect(isFtypValidMp4(new Uint8Array([0, 0]).buffer)).toBe(false);
	});
});
