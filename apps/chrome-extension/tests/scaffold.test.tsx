import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
} from '@celestia/tiktok-live-core';
import { soundManager } from '@celestia/ui';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manifestDefinition } from '../manifest.config.js';
import { useLiveEventStore } from '../src/side-panel/live-event-store.js';
import {
	type CelestiaDevToolsNamespace,
	SidePanel,
	type TabObserver,
} from '../src/side-panel/side-panel.js';

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

type DevToolsTestWindow = Window & {
	__CELESTIA__?: CelestiaDevToolsNamespace;
	__CELESTIA_EXPORT_LIVE_TRACE__?: unknown;
};

describe('Chrome extension scaffold', () => {
	beforeEach(() => {
		resetLiveEventStore();
		window.localStorage.clear();
		delete (window as DevToolsTestWindow).__CELESTIA__;
		delete (window as DevToolsTestWindow).__CELESTIA_EXPORT_LIVE_TRACE__;
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('declares the Side Panel and background service worker in the MV3 manifest', () => {
		expect(manifestDefinition.manifest_version).toBe(3);
		expect(manifestDefinition.permissions).toContain('debugger');
		expect(manifestDefinition.permissions).toContain('sidePanel');
		expect(manifestDefinition.permissions).toContain('storage');
		expect(manifestDefinition.permissions).toContain('tabs');
		expect(manifestDefinition.side_panel.default_path).toBe('src/side-panel/index.html');
		expect(manifestDefinition.background.service_worker).toBe('src/background/service-worker.ts');
	});

	it('renders the Side Panel landmark for the React entry point', () => {
		const html = renderToString(<SidePanel />);

		expect(html).toContain('aria-label="Celestia Side Panel"');
	});

	it('registers the DevTools console namespace and prints the boot banner with trace OFF', async () => {
		const group = vi.spyOn(console, 'group').mockImplementation(() => {});
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={new FakeTabObserver(undefined)} />);
		});

		const celestia = getCelestiaNamespace();

		expect(celestia).toEqual({
			enableTrace: expect.any(Function),
			disableTrace: expect.any(Function),
			cancel: expect.any(Function),
			status: expect.any(Function),
			exportTrace: expect.any(Function),
		});
		expect((window as DevToolsTestWindow).__CELESTIA_EXPORT_LIVE_TRACE__).toBeUndefined();
		expect(group).toHaveBeenCalledWith(
			'%c🔭 Celestia Debug Tools',
			expect.stringContaining('font-weight'),
		);
		expect(info).toHaveBeenCalledWith('   Trace mode:  ● OFF');
		expect(info).not.toHaveBeenCalledWith('   Export:   window.__CELESTIA__.exportTrace()');

		await act(async () => {
			celestia.status();
		});

		expect(group).toHaveBeenCalledTimes(2);

		await act(async () => {
			root.unmount();
		});
	});

	it('prints the boot banner with trace ON and exports through window.__CELESTIA__', async () => {
		window.localStorage.setItem('celestia.trace', '1');
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@celestia/live');
		const provider = new FakeProvider();
		provider.traceJson = '{"schema":"celestia-trace-v1"}';
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} providerFactory={() => provider} />);
		});

		expect(info).toHaveBeenCalledWith('   Trace mode:  ● ON ✓');
		expect(info).toHaveBeenCalledWith('   Export:   window.__CELESTIA__.exportTrace()');

		await clickButton(container, 'Confirm');

		await expect(getCelestiaNamespace().exportTrace()).resolves.toBe(
			'{"schema":"celestia-trace-v1"}',
		);
		expect(info).toHaveBeenCalledWith('[Celestia Trace]', '{"schema":"celestia-trace-v1"}');

		await act(async () => {
			root.unmount();
		});
	});

	it('warns from exportTrace when trace is unavailable or empty', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={new FakeTabObserver(undefined)} />);
		});

		await expect(getCelestiaNamespace().exportTrace()).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Trace mode is OFF'));

		window.localStorage.setItem('celestia.trace', '1');

		await expect(getCelestiaNamespace().exportTrace()).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Connect to a Live Session first'));

		await act(async () => {
			root.unmount();
		});
	});

	it('enables, disables, and cancels trace reloads from the DevTools namespace', async () => {
		vi.useFakeTimers();
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={new FakeTabObserver(undefined)} />);
		});

		getCelestiaNamespace().enableTrace();
		getCelestiaNamespace().cancel();

		await vi.advanceTimersByTimeAsync(3000);

		expect(window.localStorage.getItem('celestia.trace')).toBeNull();
		expect(info).toHaveBeenCalledWith('[Celestia Debug Tools] Pending trace reload canceled.');

		getCelestiaNamespace().enableTrace();
		await vi.advanceTimersByTimeAsync(3000);

		expect(window.localStorage.getItem('celestia.trace')).toBe('1');

		getCelestiaNamespace().disableTrace();
		await vi.advanceTimersByTimeAsync(3000);

		expect(window.localStorage.getItem('celestia.trace')).toBeNull();

		await act(async () => {
			root.unmount();
		});
	});

	it('navigates to a TikTok Live URL from the landing modal', async () => {
		const tabObserver = new FakeTabObserver('https://example.com/');
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} />);
		});

		const input = container.querySelector('input[name="username"]');
		const form = container.querySelector('form');

		expect(input).toBeInstanceOf(HTMLInputElement);
		expect(form).toBeInstanceOf(HTMLFormElement);

		await act(async () => {
			(input as HTMLInputElement).value = ' @celestia ';
			input?.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await act(async () => {
			form?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		});

		expect(tabObserver.navigatedUrls).toEqual(['https://www.tiktok.com/@celestia/live']);

		await act(async () => {
			root.unmount();
		});
	});

	it('asks before inspecting an initial TikTok Live tab and keeps the feed visible after navigating away', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@first.creator/live');
		const provider = new FakeProvider();
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} providerFactory={() => provider} />);
		});

		expect(container.textContent).toContain("Inspect @first.creator's Live Session?");
		expect(provider.attachCalls).toEqual([]);

		await clickButton(container, 'Confirm');

		expect(container.textContent).toContain('@first.creator');
		expect(provider.attachCalls).toEqual([{ tabId: 42, username: 'first.creator' }]);

		await act(async () => {
			tabObserver.emit('https://example.com/not-live');
		});

		expect(container.textContent).toContain('@first.creator');
		expect(container.textContent).not.toContain('TikTok username');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@second_creator/live');
		});

		expect(container.textContent).toContain('@first.creator');
		expect(container.textContent).toContain(
			'Celestia is watching @first.creator. Switch to @second_creator?',
		);
		expect(provider.attachCalls).toEqual([{ tabId: 42, username: 'first.creator' }]);

		await act(async () => {
			root.unmount();
		});
	});

	it('updates, closes, and suppresses inspection prompts without changing the confirmed Provider target', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@confirmed/live', 101);
		const provider = new FakeProvider();
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} providerFactory={() => provider} />);
		});

		await clickButton(container, 'Confirm');

		expect(provider.attachCalls).toEqual([{ tabId: 101, username: 'confirmed' }]);
		expect(container.textContent).toContain('@confirmed');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@candidate/live', 202);
		});

		expect(provider.attachCalls).toEqual([{ tabId: 101, username: 'confirmed' }]);
		expect(provider.disconnectCount).toBe(0);
		expect(container.textContent).toContain('@confirmed');
		expect(container.textContent).toContain(
			'Celestia is watching @confirmed. Switch to @candidate?',
		);

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@updated/live', 203);
		});

		expect(container.textContent).toContain('Celestia is watching @confirmed. Switch to @updated?');
		expect(container.textContent).not.toContain('Switch to @candidate?');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@confirmed/live', 101);
		});

		expect(provider.attachCalls).toEqual([{ tabId: 101, username: 'confirmed' }]);
		expect(container.textContent).toContain('@confirmed');
		expect(container.textContent).not.toContain('Switch to @updated?');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@candidate/live', 202);
		});

		expect(container.textContent).toContain('Switch to @candidate?');

		await clickButton(container, 'Deny');

		expect(provider.attachCalls).toEqual([{ tabId: 101, username: 'confirmed' }]);
		expect(provider.disconnectCount).toBe(0);
		expect(container.textContent).not.toContain('Switch to @candidate?');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@candidate/live', 202);
		});

		expect(container.textContent).not.toContain('Switch to @candidate?');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@candidate/live?changed=1', 202);
		});

		expect(container.textContent).toContain('Switch to @candidate?');

		await act(async () => {
			tabObserver.emit('https://example.com/not-live', 303);
		});

		expect(provider.attachCalls).toEqual([{ tabId: 101, username: 'confirmed' }]);
		expect(container.textContent).toContain('@confirmed');

		await act(async () => {
			root.unmount();
		});
	});

	it('confirms a target switch by detaching the old Provider session and resetting the feed', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@confirmed/live', 101);
		const provider = new FakeProvider();
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} providerFactory={() => provider} />);
		});

		await clickButton(container, 'Confirm');

		await act(async () => {
			provider.emitEvent({
				id: 'chat-1',
				ts: Date.now(),
				type: 'chat',
				source: 'test',
				text: 'before switch',
				user: {
					userId: 'viewer-1',
					uniqueId: 'viewer.one',
					nickname: 'Viewer One',
				},
			});
		});

		expect(container.textContent).toContain('before switch');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@candidate/live', 202);
		});

		await clickButton(container, 'Confirm');

		expect(provider.attachCalls).toEqual([
			{ tabId: 101, username: 'confirmed' },
			{ tabId: 202, username: 'candidate' },
		]);
		expect(provider.disconnectCount).toBe(1);
		expect(container.textContent).toContain('@candidate');
		expect(container.textContent).not.toContain('before switch');

		await act(async () => {
			root.unmount();
		});
	});

	it('attaches the Provider for TikTok Live tabs, dispatches events to the store, and detaches on unmount', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@celestia/live');
		const provider = new FakeProvider();
		const playSound = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} providerFactory={() => provider} />);
		});

		await clickButton(container, 'Confirm');

		expect(provider.attachCalls).toEqual([{ tabId: 42, username: 'celestia' }]);

		await act(async () => {
			provider.emitState({ status: 'connected', username: 'celestia' });
			provider.emitEvent({
				id: 'viewers-1',
				ts: Date.now(),
				type: 'viewer_count',
				source: 'test',
				viewerCount: 1234,
			});
			provider.emitEvent({
				id: 'likes-1',
				ts: Date.now(),
				type: 'like',
				source: 'test',
				totalLikeCount: 5678,
			});
			provider.emitEvent({
				id: 'member-1',
				ts: Date.now(),
				type: 'member',
				source: 'test',
				user: {
					userId: 'viewer-1',
					uniqueId: 'viewer.one',
					nickname: 'Viewer One',
				},
			});
			provider.emitEvent({
				id: 'chat-1',
				ts: Date.now(),
				type: 'chat',
				source: 'test',
				text: 'hello',
				user: {
					userId: 'viewer-1',
					uniqueId: 'viewer.one',
					nickname: 'Viewer One',
				},
			});
			provider.emitEvent({
				id: 'gift-1',
				ts: Date.now(),
				type: 'gift',
				source: 'test',
				giftName: 'Galaxy',
				giftImageUrl: 'https://example.test/galaxy.png',
				diamondCount: 1000,
				repeatCount: 2,
			});
		});

		expect(container.textContent).toContain('1,234');
		expect(container.textContent).toContain('5,678');
		expect(container.textContent).toContain('Viewer One joined');
		expect(playSound).toHaveBeenCalledTimes(2);
		expect(playSound).toHaveBeenNthCalledWith(1, 'chat');
		expect(playSound).toHaveBeenNthCalledWith(2, 'gift');

		await act(async () => {
			container
				.querySelector('[data-celestia-activity-switcher]')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(container.textContent).toContain('Galaxy');
		expect(container.textContent).toContain('x2');

		await act(async () => {
			provider.emitEvent({
				id: 'end-1',
				ts: Date.now(),
				type: 'stream_end',
				source: 'test',
			});
		});

		expect(container.textContent).toContain('1,234');
		expect(container.textContent).toContain('5,678');
		expect(container.textContent).toContain('Stream Ended');

		await act(async () => {
			root.unmount();
		});

		expect(provider.disconnectCount).toBe(1);
		expect(provider.destroyCount).toBe(1);
	});

	it('keeps the Side Panel mounted when the Provider cannot access Chrome APIs', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@celestia/live');
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<SidePanel
					tabObserver={tabObserver}
					providerFactory={() => {
						throw new Error('chrome.debugger is unavailable');
					}}
				/>,
			);
		});

		await clickButton(container, 'Confirm');

		expect(container.textContent).toContain('@celestia');
		expect(container.textContent).toContain('Reconnecting');

		await act(async () => {
			root.unmount();
		});
	});
});

async function clickButton(container: HTMLElement, label: string): Promise<void> {
	const button = Array.from(container.querySelectorAll('button')).find(
		(element) => element.textContent === label,
	);

	expect(button).toBeInstanceOf(HTMLButtonElement);

	await act(async () => {
		button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
}

function resetLiveEventStore(): void {
	useLiveEventStore.setState({
		connectionState: { status: 'idle', username: '' },
		streamerUsername: null,
		viewerCount: 0,
		likeCount: 0,
		chatEvents: [],
		giftEvents: [],
		memberEvents: [],
		userGiftEvents: new Map(),
	});
}

class FakeTabObserver implements TabObserver {
	readonly navigatedUrls: string[] = [];
	#listener: ((tab: ChromeApi.Tab | undefined) => void) | undefined;

	constructor(
		private url: string | undefined,
		private tabId = 42,
	) {}

	async getCurrentTab(): Promise<ChromeApi.Tab | undefined> {
		return this.url === undefined ? undefined : { id: this.tabId, url: this.url, active: true };
	}

	async navigateCurrentTab(url: string): Promise<void> {
		this.navigatedUrls.push(url);
	}

	subscribe(listener: (tab: ChromeApi.Tab | undefined) => void): () => void {
		this.#listener = listener;
		return () => {
			this.#listener = undefined;
		};
	}

	emit(url: string | undefined, tabId = this.tabId): void {
		this.url = url;
		this.tabId = tabId;
		this.#listener?.(url === undefined ? undefined : { id: tabId, url, active: true });
	}
}

class FakeProvider implements TikTokLiveProvider {
	attachCalls: Array<{ tabId: number; username: string }> = [];
	disconnectCount = 0;
	destroyCount = 0;
	traceJson: string | undefined;
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

	async exportTraceJson(): Promise<string | undefined> {
		return this.traceJson;
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

function getCelestiaNamespace(): CelestiaDevToolsNamespace {
	const celestia = (window as DevToolsTestWindow).__CELESTIA__;

	expect(celestia).toBeDefined();
	return celestia as NonNullable<typeof celestia>;
}
