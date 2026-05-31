import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
} from '@celestia/tiktok-live-core';
import { soundManager } from '@celestia/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
	afterEach(() => {
		vi.restoreAllMocks();
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
});

interface RenderSessionTabOptions {
	tiktokTabId: number;
	provider: FakeProvider;
	tabUrl?: string;
	watchTabClosed?: (tabId: number, listener: () => void) => () => void;
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

function viewerCountEvent(viewerCount: number): LiveEvent {
	return {
		id: `viewers-${viewerCount}`,
		ts: Date.now(),
		type: 'viewer_count',
		source: 'test',
		viewerCount,
	};
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
