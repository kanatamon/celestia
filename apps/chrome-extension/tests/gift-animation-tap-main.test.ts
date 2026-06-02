import {
	GIFT_ANIMATION_DECRYPT_KEY,
	GIFT_ANIMATION_MIME_TYPE,
	GIFT_ANIMATION_TAP_SOURCE,
	installGiftAnimationTap,
} from '@celestia/tiktok-live-chrome-extension';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavioral coverage for the MAIN-world tap installed by the classic-IIFE build
 * plugin (issue #65). The package's own `.test.ts` are typecheck-only, so the
 * runtime behavior is exercised here in the app's jsdom suite.
 *
 * We pass a hand-built `target` rather than the real `window`: jsdom has no
 * `Worker`, and a plain object lets us drive `postMessage`/`createObjectURL`
 * directly and detect when our wrapper is displaced.
 */

function createTarget() {
	const postMessage = vi.fn();
	// A mutable holder so the production code can re-assign `URL.createObjectURL`,
	// and so a test can later overwrite it to simulate displacement.
	const url = { createObjectURL: vi.fn(() => 'blob:original') };

	class FakeWorker {
		postMessage(_message: unknown): void {
			// Original prototype method; the tap wraps this.
		}
	}

	const target = {
		Worker: FakeWorker,
		URL: url,
		postMessage,
		location: { origin: 'https://www.tiktok.com' },
	} as unknown as Window & typeof globalThis;

	return { target, postMessage, url, FakeWorker };
}

function postWorkerMessage(
	FakeWorker: { prototype: { postMessage: (m: unknown) => void } },
	message: unknown,
): void {
	const worker = Object.create(FakeWorker.prototype) as { postMessage: (m: unknown) => void };
	worker.postMessage(message);
}

const decryptMessage = {
	decryptKey: GIFT_ANIMATION_DECRYPT_KEY,
	url: 'https://cdn.example/abc.zip',
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('installGiftAnimationTap', () => {
	it('arms on the gift decrypt message and bridges the next mp4 blob to the isolated relay', async () => {
		const { target, postMessage, FakeWorker } = createTarget();
		installGiftAnimationTap(target);

		postWorkerMessage(FakeWorker, decryptMessage);
		const blob = new Blob([new Uint8Array([1, 2, 3])], { type: GIFT_ANIMATION_MIME_TYPE });
		target.URL.createObjectURL(blob);

		// forwardCapturedAsset reads blob.arrayBuffer() then posts — let it settle.
		await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

		const firstCall = postMessage.mock.calls.at(0);
		if (!firstCall) throw new Error('expected a bridge postMessage call');
		const [message, origin] = firstCall;
		expect(origin).toBe('https://www.tiktok.com');
		expect(message).toMatchObject({
			source: GIFT_ANIMATION_TAP_SOURCE,
			mimeType: GIFT_ANIMATION_MIME_TYPE,
		});
		expect(message.bytes).toBeInstanceOf(ArrayBuffer);
	});

	it('does not bridge unarmed mp4 blobs', async () => {
		const { target, postMessage } = createTarget();
		installGiftAnimationTap(target);

		const blob = new Blob([new Uint8Array([1])], { type: GIFT_ANIMATION_MIME_TYPE });
		target.URL.createObjectURL(blob);

		await Promise.resolve();
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('logs an error when armed but the createObjectURL wrapper has been displaced (#65 self-check)', () => {
		const { target, FakeWorker } = createTarget();
		installGiftAnimationTap(target);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Simulate TikTok (or a cached original) replacing our wrapper.
		target.URL.createObjectURL = vi.fn(() => 'blob:impostor');
		postWorkerMessage(FakeWorker, decryptMessage);

		expect(errorSpy).toHaveBeenCalledTimes(1);
		const firstError = errorSpy.mock.calls.at(0);
		if (!firstError) throw new Error('expected a console.error call');
		expect(firstError[0]).toContain('[gift-animation-tap]');
	});

	it('stays silent on arm while our wrapper is still installed', () => {
		const { target, FakeWorker } = createTarget();
		installGiftAnimationTap(target);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		postWorkerMessage(FakeWorker, decryptMessage);

		expect(errorSpy).not.toHaveBeenCalled();
	});
});
