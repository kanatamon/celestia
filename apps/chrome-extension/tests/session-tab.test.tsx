import {
	arrayBufferToBase64,
	GIFT_ANIMATION_ASSET_CAPTURED,
	type GiftAnimationAssetCapturedMessage,
} from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
} from '@celestia/tiktok-live-core';
import { configureCelebrationSettingsStorage, soundManager } from '@celestia/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTab } from '../src/session-tab/session-tab.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM doesn't implement HTMLElement.scrollTo, which the shared feed uses.
if (!HTMLElement.prototype.scrollTo) {
	HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number) {
		if (typeof options === 'object' && options?.top !== undefined) {
			this.scrollTop = options.top;
		}
	};
}

describe('Session Tab', () => {
	let celebrationThreshold = 99;

	beforeEach(() => {
		delete window.__celestiaPlayCelebration;
		// Reset the live Celebration Threshold the synthesized trigger reads, so a
		// test that mutates it (below) cannot leak into the default-99 tests.
		celebrationThreshold = 99;
		configureCelebrationSettingsStorage({
			getThreshold: () => celebrationThreshold,
			setThreshold: (value) => {
				celebrationThreshold = value;
			},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		delete window.__celestiaPlayCelebration;
		celebrationThreshold = 99;
		configureCelebrationSettingsStorage({
			getThreshold: () => celebrationThreshold,
			setThreshold: (value) => {
				celebrationThreshold = value;
			},
		});
	});

	it('attaches the Provider to the paired tiktokTabId and dispatches LiveEvents to the feed', async () => {
		const provider = new FakeProvider();
		const playSound = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const mount = await renderSessionTab({
			tiktokTabId: 77,
			provider,
			tabUrl: 'https://www.tiktok.com/@celestia/live',
		});

		expect(provider.attachCalls).toEqual([{ tabId: 77, username: 'celestia' }]);

		await act(async () => {
			provider.emitState({ status: 'connected', username: 'celestia' });
			provider.emitEvent(viewerCountEvent(1234));
			provider.emitEvent(chatEvent('chat-1', 'hello there'));
		});

		expect(mount.container.textContent).toContain('1,234');
		expect(mount.container.textContent).toContain('hello there');
		expect(playSound).toHaveBeenCalledWith('chat');

		await mount.unmount();
		expect(provider.disconnectCount).toBe(1);
		expect(provider.destroyCount).toBe(1);
	});

	it('renders a persistent disconnected state when the paired TikTok Live tab is closed, without closing itself', async () => {
		const provider = new FakeProvider();
		const tabClosed = new FakeTabCloseWatcher();
		const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
		const mount = await renderSessionTab({
			tiktokTabId: 88,
			provider,
			tabUrl: 'https://www.tiktok.com/@nova/live',
			watchTabClosed: tabClosed.watch,
		});

		await act(async () => {
			provider.emitState({ status: 'connected', username: 'nova' });
			provider.emitEvent(chatEvent('chat-1', 'still here'));
		});

		await act(async () => {
			tabClosed.fire();
		});

		const banner = mount.container.querySelector('[aria-label="Session disconnected"]');
		expect(banner).toBeInstanceOf(HTMLElement);
		expect(banner?.textContent).toContain('closed');
		// The event feed stays readable after disconnect.
		expect(mount.container.textContent).toContain('still here');
		expect(closeSpy).not.toHaveBeenCalled();

		await mount.unmount();
	});

	it('keeps two Session Tabs with different tiktokTabId values isolated', async () => {
		const providerA = new FakeProvider();
		const providerB = new FakeProvider();
		const mountA = await renderSessionTab({
			tiktokTabId: 1,
			provider: providerA,
			tabUrl: 'https://www.tiktok.com/@alpha/live',
		});
		const mountB = await renderSessionTab({
			tiktokTabId: 2,
			provider: providerB,
			tabUrl: 'https://www.tiktok.com/@bravo/live',
		});

		await act(async () => {
			providerA.emitEvent(chatEvent('a-1', 'alpha message'));
			providerB.emitEvent(chatEvent('b-1', 'bravo message'));
		});

		expect(mountA.container.textContent).toContain('alpha message');
		expect(mountA.container.textContent).not.toContain('bravo message');
		expect(mountB.container.textContent).toContain('bravo message');
		expect(mountB.container.textContent).not.toContain('alpha message');

		await mountA.unmount();
		await mountB.unmount();
	});

	it('exposes a dev-only console trigger that plays the sample Gift Animation Asset', async () => {
		const provider = new FakeProvider();
		const createObjectURL = vi.fn(() => 'blob:sample-gift-animation');
		const revokeObjectURL = vi.fn();
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			blob: async () => new Blob(['sample'], { type: 'video/mp4' }),
		} as Response);
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
		vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
		vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectURL,
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: revokeObjectURL,
		});
		const mount = await renderSessionTab({
			tiktokTabId: 91,
			provider,
			tabUrl: 'https://www.tiktok.com/@sample/live',
		});

		try {
			expect(window.__celestiaPlayCelebration).toEqual(expect.any(Function));

			await act(async () => {
				await window.__celestiaPlayCelebration?.();
			});

			expect(fetch).toHaveBeenCalledWith('/src/session-tab/assets/sample-gift-animation.mp4');
			expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
			expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeInstanceOf(
				HTMLElement,
			);
		} finally {
			await mount.unmount();
			Object.defineProperty(URL, 'createObjectURL', {
				configurable: true,
				value: originalCreateObjectURL,
			});
			Object.defineProperty(URL, 'revokeObjectURL', {
				configurable: true,
				value: originalRevokeObjectURL,
			});
		}

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:sample-gift-animation');
	});

	it('celebrates a real captured Gift Animation Asset, minting its URL in the Session Tab and revoking it on teardown', async () => {
		const provider = new FakeProvider();
		const feed = new FakeAssetFeed();
		const createObjectURL = vi.fn(() => 'blob:captured-gift');
		const revokeObjectURL = vi.fn();
		withMockedObjectUrl(createObjectURL, revokeObjectURL);
		mockCelebrationMedia();

		const mount = await renderSessionTab({
			tiktokTabId: 101,
			provider,
			tabUrl: 'https://www.tiktok.com/@captured/live',
			subscribeAssets: feed.subscribe,
		});

		try {
			await act(async () => {
				feed.emit(capturedAsset(ftypMp4Bytes()));
			});

			const celebration = mount.container.querySelector('[aria-label="Gift Celebration"]');
			expect(celebration).toBeInstanceOf(HTMLElement);
			// The object URL is minted in the Session Tab context from the bytes.
			expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
		} finally {
			await mount.unmount();
			restoreObjectUrl();
		}

		// No URLs leak across the Live Session: the stage revokes the owned URL.
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:captured-gift');
	});

	it('coalesces a burst of the byte-identical gift into a single celebration', async () => {
		const provider = new FakeProvider();
		const feed = new FakeAssetFeed();
		const createObjectURL = vi.fn(
			(_blob: Blob) => `blob:gift-${createObjectURL.mock.calls.length}`,
		);
		const revokeObjectURL = vi.fn();
		withMockedObjectUrl(createObjectURL, revokeObjectURL);
		mockCelebrationMedia();

		const mount = await renderSessionTab({
			tiktokTabId: 103,
			provider,
			tabUrl: 'https://www.tiktok.com/@burst/live',
			subscribeAssets: feed.subscribe,
		});

		try {
			await act(async () => {
				feed.emit(capturedAsset(ftypMp4Bytes()));
				feed.emit(capturedAsset(ftypMp4Bytes()));
				feed.emit(capturedAsset(ftypMp4Bytes()));
			});

			// One celebration plays; the byte-identical repeats coalesce away and
			// their freshly minted URLs are reclaimed immediately.
			expect(mount.container.querySelectorAll('[aria-label="Gift Celebration"]')).toHaveLength(1);
			expect(createObjectURL).toHaveBeenCalledTimes(3);
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:gift-2');
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:gift-3');
			expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:gift-1');
		} finally {
			await mount.unmount();
			restoreObjectUrl();
		}
	});

	it('does not celebrate when no Gift Animation Asset is captured', async () => {
		const provider = new FakeProvider();
		const feed = new FakeAssetFeed();
		const mount = await renderSessionTab({
			tiktokTabId: 102,
			provider,
			tabUrl: 'https://www.tiktok.com/@silent/live',
			subscribeAssets: feed.subscribe,
		});

		// A gift with no animation arrives in the feed but delivers no asset bytes.
		await act(async () => {
			provider.emitEvent(chatEvent('chat-1', 'no animation gift'));
		});

		expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();
		expect(mount.container.textContent).toContain('no animation gift');

		await mount.unmount();
	});

	it('synthesizes a celebration for an above-threshold gift that gets no asset within the grace window', async () => {
		vi.useFakeTimers();
		const provider = new FakeProvider();
		mockCelebrationMedia();
		const mount = await renderSessionTab({
			tiktokTabId: 110,
			provider,
			tabUrl: 'https://www.tiktok.com/@synth/live',
		});

		try {
			await act(async () => {
				provider.emitEvent(giftEvent('gift-1', { diamondCount: 99, giftImageUrl: 'icon-a' }));
			});

			// Before the grace window elapses, no celebration synthesizes.
			expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(1500);
			});

			const celebration = mount.container.querySelector('[aria-label="Gift Celebration"]');
			expect(celebration).toBeInstanceOf(HTMLElement);
			// Synthesized path renders the icon triptych, not a <video>.
			expect(celebration?.querySelector('video')).toBeNull();
			expect(celebration?.querySelector(`img[src="icon-a"]`)).toBeInstanceOf(HTMLElement);
			expect(
				celebration?.querySelector('img[aria-label="Gift Celebration center"]'),
			).toBeInstanceOf(HTMLImageElement);
		} finally {
			await mount.unmount();
			vi.useRealTimers();
		}
	});

	it('does not synthesize when an asset arrives within the grace window (animated path owns it)', async () => {
		vi.useFakeTimers();
		const provider = new FakeProvider();
		const feed = new FakeAssetFeed();
		withMockedObjectUrl(
			vi.fn(() => 'blob:animated-gift'),
			vi.fn(),
		);
		mockCelebrationMedia();
		const mount = await renderSessionTab({
			tiktokTabId: 111,
			provider,
			tabUrl: 'https://www.tiktok.com/@mixed/live',
			subscribeAssets: feed.subscribe,
		});

		try {
			await act(async () => {
				provider.emitEvent(giftEvent('gift-1', { diamondCount: 200, giftImageUrl: 'icon-a' }));
			});
			await act(async () => {
				feed.emit(capturedAsset(ftypMp4Bytes()));
			});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(1500);
			});

			// Exactly one celebration — the Animated one (a <canvas> centre pane), not
			// a synthesized icon triptych (whose centre pane is an <img>).
			const celebrations = mount.container.querySelectorAll('[aria-label="Gift Celebration"]');
			expect(celebrations).toHaveLength(1);
			expect(mount.container.querySelector('img[aria-label="Gift Celebration center"]')).toBeNull();
		} finally {
			await mount.unmount();
			restoreObjectUrl();
			vi.useRealTimers();
		}
	});

	it('never synthesizes for a sub-threshold, zero-diamond, or icon-less gift', async () => {
		vi.useFakeTimers();
		const provider = new FakeProvider();
		mockCelebrationMedia();
		const mount = await renderSessionTab({
			tiktokTabId: 112,
			provider,
			tabUrl: 'https://www.tiktok.com/@quiet/live',
		});

		try {
			await act(async () => {
				provider.emitEvent(giftEvent('g1', { diamondCount: 98, giftImageUrl: 'cheap' }));
				provider.emitEvent(giftEvent('g2', { diamondCount: 0, giftImageUrl: 'free' }));
				provider.emitEvent(giftEvent('g3', { diamondCount: 500, giftImageUrl: undefined }));
			});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(1500);
			});

			expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();
		} finally {
			await mount.unmount();
			vi.useRealTimers();
		}
	});

	it('consults the live Celebration Threshold so a slider change takes effect without a reload', async () => {
		vi.useFakeTimers();
		const provider = new FakeProvider();
		mockCelebrationMedia();
		const mount = await renderSessionTab({
			tiktokTabId: 113,
			provider,
			tabUrl: 'https://www.tiktok.com/@live-threshold/live',
		});

		try {
			// Raise the threshold above the gift's diamondCount mid-session (as the
			// settings slider would). The next gift must NOT synthesize.
			celebrationThreshold = 300;

			await act(async () => {
				provider.emitEvent(giftEvent('gift-1', { diamondCount: 200, giftImageUrl: 'icon-a' }));
			});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(1500);
			});
			expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

			// Lower it below the next gift's value; that gift now synthesizes — no remount.
			celebrationThreshold = 150;

			await act(async () => {
				provider.emitEvent(giftEvent('gift-2', { diamondCount: 200, giftImageUrl: 'icon-b' }));
			});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(1500);
			});

			const celebration = mount.container.querySelector('[aria-label="Gift Celebration"]');
			expect(celebration).toBeInstanceOf(HTMLElement);
			expect(celebration?.querySelector('img[src="icon-b"]')).toBeInstanceOf(HTMLElement);
		} finally {
			await mount.unmount();
			vi.useRealTimers();
		}
	});

	it('does not expose the sample Gift Animation Asset trigger in production builds', async () => {
		vi.stubEnv('DEV', false);
		const provider = new FakeProvider();
		const mount = await renderSessionTab({
			tiktokTabId: 92,
			provider,
			tabUrl: 'https://www.tiktok.com/@production/live',
		});

		expect(window.__celestiaPlayCelebration).toBeUndefined();
		expect(mount.container.querySelector('[aria-label="Gift Celebration"]')).toBeNull();

		await mount.unmount();
	});
});

declare global {
	interface Window {
		__celestiaPlayCelebration?: (assetId?: string) => Promise<void>;
	}
}

interface RenderSessionTabOptions {
	tiktokTabId: number;
	provider: FakeProvider;
	tabUrl?: string;
	watchTabClosed?: (tabId: number, listener: () => void) => () => void;
	subscribeAssets?: (onAsset: (asset: GiftAnimationAssetCapturedMessage) => void) => () => void;
}

interface MountedSessionTab {
	container: HTMLElement;
	root: Root;
	unmount(): Promise<void>;
}

async function renderSessionTab(options: RenderSessionTabOptions): Promise<MountedSessionTab> {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);

	await act(async () => {
		root.render(
			<SessionTab
				tiktokTabId={options.tiktokTabId}
				providerFactory={() => options.provider}
				resolveTab={async () => ({ url: options.tabUrl })}
				watchTabClosed={options.watchTabClosed}
				subscribeAssets={options.subscribeAssets}
			/>,
		);
		await Promise.resolve();
	});

	return {
		container,
		root,
		async unmount() {
			await act(async () => {
				root.unmount();
			});
			container.remove();
		},
	};
}

function chatEvent(id: string, text: string): LiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'chat',
		source: 'test',
		text,
		user: {
			userId: `user-${id}`,
			uniqueId: `user.${id}`,
			nickname: `User ${id}`,
		},
	};
}

function giftEvent(
	id: string,
	fields: { diamondCount?: number; giftImageUrl?: string },
): LiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'gift',
		source: 'test',
		diamondCount: fields.diamondCount,
		giftImageUrl: fields.giftImageUrl,
	};
}

function viewerCountEvent(viewerCount: number): LiveEvent {
	return {
		id: `viewers-${viewerCount}`,
		ts: Date.now(),
		type: 'viewer_count',
		source: 'test',
		viewerCount,
	};
}

function ftypMp4Bytes(): ArrayBuffer {
	return new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).buffer;
}

function capturedAsset(bytes: ArrayBuffer): GiftAnimationAssetCapturedMessage {
	return {
		type: GIFT_ANIMATION_ASSET_CAPTURED,
		mimeType: 'video/mp4',
		bytesBase64: arrayBufferToBase64(bytes),
	};
}

class FakeAssetFeed {
	#listener: ((asset: GiftAnimationAssetCapturedMessage) => void) | undefined;

	subscribe = (onAsset: (asset: GiftAnimationAssetCapturedMessage) => void): (() => void) => {
		this.#listener = onAsset;
		return () => {
			this.#listener = undefined;
		};
	};

	emit(asset: GiftAnimationAssetCapturedMessage): void {
		this.#listener?.(asset);
	}
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function withMockedObjectUrl(createObjectURL: () => string, revokeObjectURL: () => void): void {
	Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
	Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
}

function restoreObjectUrl(): void {
	Object.defineProperty(URL, 'createObjectURL', {
		configurable: true,
		value: originalCreateObjectURL,
	});
	Object.defineProperty(URL, 'revokeObjectURL', {
		configurable: true,
		value: originalRevokeObjectURL,
	});
}

function mockCelebrationMedia(): void {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
	vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
	vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
}

class FakeTabCloseWatcher {
	#listener: (() => void) | undefined;

	watch = (_tabId: number, listener: () => void): (() => void) => {
		this.#listener = listener;
		return () => {
			this.#listener = undefined;
		};
	};

	fire(): void {
		this.#listener?.();
	}
}

class FakeProvider implements TikTokLiveProvider {
	attachCalls: Array<{ tabId: number; username: string }> = [];
	disconnectCount = 0;
	destroyCount = 0;
	#state: ConnectionState = { status: 'idle', username: '' };
	#eventHandlers = new Set<(event: LiveEvent) => void>();
	#stateHandlers = new Set<(state: ConnectionState) => void>();

	async connect(username: string): Promise<ConnectionState> {
		return this.attach(0, username);
	}

	async attach(tabId: number, username: string): Promise<ConnectionState> {
		this.attachCalls.push({ tabId, username });
		this.emitState({ status: 'attached', username });
		return this.#state;
	}

	async disconnect(): Promise<ConnectionState> {
		this.disconnectCount += 1;
		this.emitState({ status: 'detached', username: this.#state.username });
		return this.#state;
	}

	getConnectionState(): ConnectionState {
		return this.#state;
	}

	onEvent(handler: (event: LiveEvent) => void): Unsubscribe {
		this.#eventHandlers.add(handler);
		return () => {
			this.#eventHandlers.delete(handler);
		};
	}

	onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe {
		this.#stateHandlers.add(handler);
		handler(this.#state);
		return () => {
			this.#stateHandlers.delete(handler);
		};
	}

	onLog(_handler: (log: ProviderLog) => void): Unsubscribe {
		return () => {};
	}

	destroy(): void {
		this.destroyCount += 1;
	}

	emitEvent(event: LiveEvent): void {
		for (const handler of this.#eventHandlers) {
			handler(event);
		}
	}

	emitState(state: ConnectionState): void {
		this.#state = state;
		for (const handler of this.#stateHandlers) {
			handler(state);
		}
	}
}
