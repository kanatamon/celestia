import {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
	isGiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	isFtypValidMp4,
	subscribeGiftAnimationAssets,
	toCapturedCelebration,
} from '../src/session-tab/gift-animation-asset-receiver.js';

function assetWithBytes(bytes: ArrayBuffer): GiftAnimationAssetCapturedMessage {
	return {
		type: GIFT_ANIMATION_ASSET_CAPTURED,
		mimeType: 'video/mp4',
		bytesBase64: arrayBufferToBase64(bytes),
	};
}

function bytesOf(...values: number[]): ArrayBuffer {
	return new Uint8Array(values).buffer;
}

function ftypMp4(): ArrayBuffer {
	// size (4 bytes) + 'ftyp' + brand
	return new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).buffer;
}

function capturedMessage(): GiftAnimationAssetCapturedMessage {
	return {
		type: GIFT_ANIMATION_ASSET_CAPTURED,
		mimeType: 'video/mp4',
		bytesBase64: arrayBufferToBase64(ftypMp4()),
	};
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

describe('captured-asset message survives chrome.runtime/chrome.tabs JSON hops', () => {
	// Regression for the dropped Gift Celebration: chrome.runtime/chrome.tabs
	// messaging is JSON-serialized, NOT structured-clone. A raw ArrayBuffer flattens
	// to `{}` and the type guard rejects it, so the asset never reaches the Session
	// Tab. JSON.parse(JSON.stringify(...)) reproduces exactly that serialization.
	function overTheWire(message: GiftAnimationAssetCapturedMessage): unknown {
		return JSON.parse(JSON.stringify(message));
	}

	it('still validates after a JSON round-trip', () => {
		const message = capturedMessage();
		expect(isGiftAnimationAssetCapturedMessage(overTheWire(message))).toBe(true);
	});

	it('decodes back to byte-identical content after a JSON round-trip', () => {
		const original = new Uint8Array([0, 1, 2, 250, 251, 255, 7, 42]);
		const message: GiftAnimationAssetCapturedMessage = {
			type: GIFT_ANIMATION_ASSET_CAPTURED,
			mimeType: 'video/mp4',
			bytesBase64: arrayBufferToBase64(original.buffer),
		};

		const wire = overTheWire(message) as GiftAnimationAssetCapturedMessage;
		expect(new Uint8Array(base64ToArrayBuffer(wire.bytesBase64))).toEqual(original);
	});

	it('would have rejected a raw ArrayBuffer payload (the original bug)', () => {
		const broken = {
			type: GIFT_ANIMATION_ASSET_CAPTURED,
			mimeType: 'video/mp4',
			bytes: new Uint8Array([0, 0, 0, 24]).buffer,
		};
		// After JSON serialization an ArrayBuffer becomes `{}` — no longer a valid message.
		expect(isGiftAnimationAssetCapturedMessage(JSON.parse(JSON.stringify(broken)))).toBe(false);
	});
});

describe('toCapturedCelebration', () => {
	const originalCreateObjectURL = URL.createObjectURL;

	afterEach(() => {
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: originalCreateObjectURL,
		});
		vi.restoreAllMocks();
	});

	it('mints a Session-Tab object URL from the delivered bytes', () => {
		let mintedFrom: Blob | undefined;
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: vi.fn((blob: Blob) => {
				mintedFrom = blob;
				return 'blob:minted';
			}),
		});

		const capture = toCapturedCelebration(assetWithBytes(bytesOf(1, 2, 3, 4)));

		expect(capture.assetUrl).toBe('blob:minted');
		expect(mintedFrom).toBeInstanceOf(Blob);
		expect(mintedFrom?.type).toBe('video/mp4');
	});

	it('gives byte-identical assets the same assetId so a burst coalesces', () => {
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: () => 'blob:x',
		});

		const a = toCapturedCelebration(assetWithBytes(bytesOf(9, 8, 7, 6, 5)));
		const b = toCapturedCelebration(assetWithBytes(bytesOf(9, 8, 7, 6, 5)));

		expect(a.assetId).toBe(b.assetId);
	});

	it('gives distinct assets distinct assetIds', () => {
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: () => 'blob:x',
		});

		const a = toCapturedCelebration(assetWithBytes(bytesOf(1, 2, 3, 4)));
		const b = toCapturedCelebration(assetWithBytes(bytesOf(4, 3, 2, 1)));
		const c = toCapturedCelebration(assetWithBytes(bytesOf(1, 2, 3, 4, 5)));

		expect(a.assetId).not.toBe(b.assetId);
		expect(a.assetId).not.toBe(c.assetId);
	});
});
