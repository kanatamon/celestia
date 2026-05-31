import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { manifestDefinition } from '../manifest.config.js';
import { Launcher } from '../src/launcher/launcher.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Launcher', () => {
	let chromeApi: FakeLauncherChromeApi;
	let preferences: FakePreferences;
	let registry: FakeRegistry;
	let closed: boolean;

	beforeEach(() => {
		chromeApi = new FakeLauncherChromeApi();
		preferences = new FakePreferences();
		registry = new FakeRegistry();
		closed = false;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('is wired as the Chrome action popup', () => {
		expect(manifestDefinition.action.default_popup).toBe('src/launcher/index.html');
	});

	it('renders the empty state with the recent streamer username pre-filled', async () => {
		preferences.recentStreamerUsername = 'celestia';

		const mount = await renderLauncher({ chromeApi, preferences, registry });

		expect(chromeApi.queries).toEqual([{ url: '*://www.tiktok.com/*/live*' }]);
		expect(input(mount.container).value).toBe('celestia');
		expect(mount.container.textContent).toContain('No open TikTok Live tabs');

		await mount.unmount();
	});

	it('submits a username to open a new Live Session and closes the Launcher', async () => {
		const mount = await renderLauncher({ chromeApi, preferences, registry });

		await act(async () => {
			setInputValue(input(mount.container), '@nova');
		});
		await act(async () => {
			form(mount.container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		});

		expect(chromeApi.messages).toEqual([{ type: 'OPEN_LIVE_SESSION', username: 'nova' }]);
		expect(closed).toBe(true);

		await mount.unmount();
	});

	it('preserves typed username across re-renders with a new registry reference', async () => {
		const mount = await renderLauncher({ chromeApi, preferences, registry });

		await act(async () => {
			setInputValue(input(mount.container), 'nova');
		});
		expect(input(mount.container).value).toBe('nova');

		// Simulate what happens in production: default prop values create a new
		// registry object on every render, causing the effect to re-run and reset username.
		await act(async () => {
			mount.root.render(
				<Launcher
					chromeApi={chromeApi}
					preferences={preferences}
					registry={new FakeRegistry()}
					closeWindow={() => {
						closed = true;
					}}
				/>,
			);
			await Promise.resolve();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(input(mount.container).value).toBe('nova');

		await mount.unmount();
	});

	it('shows paired and unpaired live tabs and routes each click correctly', async () => {
		chromeApi.liveTabs = [
			{ id: 10, title: 'Nova LIVE', url: 'https://www.tiktok.com/@nova/live' },
			{ id: 11, title: 'Mira LIVE', url: 'https://www.tiktok.com/@mira/live' },
		];
		registry.sessionTabIds.set(11, 99);

		const mount = await renderLauncher({ chromeApi, preferences, registry });

		expect(mount.container.textContent).toContain('nova');
		expect(mount.container.textContent).toContain('mira');
		expect(mount.container.textContent).toContain('Open Session Tab');
		expect(mount.container.textContent).toContain('Session Tab open');

		await clickButton(mount.container, 'nova');
		expect(chromeApi.messages).toEqual([
			{ type: 'OPEN_LIVE_SESSION', tiktokTabId: 10, username: 'nova' },
		]);

		closed = false;
		await clickButton(mount.container, 'mira');
		expect(chromeApi.updatedTabs).toEqual([{ tabId: 99, updateProperties: { active: true } }]);
		expect(chromeApi.messages).toHaveLength(1);
		expect(closed).toBe(true);

		await mount.unmount();
	});

	async function renderLauncher(options: {
		chromeApi: FakeLauncherChromeApi;
		preferences: FakePreferences;
		registry: FakeRegistry;
	}): Promise<MountedLauncher> {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<Launcher
					chromeApi={options.chromeApi}
					preferences={options.preferences}
					registry={options.registry}
					closeWindow={() => {
						closed = true;
					}}
				/>,
			);
			await Promise.resolve();
		});
		await act(async () => {
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
});

interface MountedLauncher {
	container: HTMLElement;
	root: Root;
	unmount(): Promise<void>;
}

function input(container: HTMLElement): HTMLInputElement {
	const element = container.querySelector('input');
	if (!(element instanceof HTMLInputElement)) {
		throw new Error('Expected Launcher input');
	}
	return element;
}

function setInputValue(element: HTMLInputElement, value: string): void {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	valueSetter?.call(element, value);
	element.dispatchEvent(
		new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
	);
}

function form(container: HTMLElement): HTMLFormElement {
	const element = container.querySelector('form');
	if (!(element instanceof HTMLFormElement)) {
		throw new Error('Expected Launcher form');
	}
	return element;
}

async function clickButton(container: HTMLElement, text: string): Promise<void> {
	const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
		candidate.textContent?.includes(text),
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Expected button containing ${text}`);
	}

	await act(async () => {
		button.click();
	});
}

class FakeLauncherChromeApi {
	liveTabs: FakeLauncherTab[] = [];
	readonly messages: unknown[] = [];
	readonly queries: unknown[] = [];
	readonly updatedTabs: { tabId: number; updateProperties: { active: boolean } }[] = [];

	runtime = {
		sendMessage: async (message: unknown): Promise<unknown> => {
			this.messages.push(message);
			return { ok: true };
		},
	};

	tabs = {
		query: async (queryInfo: { url: string }): Promise<FakeLauncherTab[]> => {
			this.queries.push(queryInfo);
			return this.liveTabs;
		},
		update: async (
			tabId: number,
			updateProperties: { active: boolean },
		): Promise<{ id: number }> => {
			this.updatedTabs.push({ tabId, updateProperties });
			return { id: tabId };
		},
	};
}

interface FakeLauncherTab {
	id?: number;
	title?: string;
	url?: string;
}

class FakePreferences {
	recentStreamerUsername: string | null = null;

	async getRecentStreamerUsername(): Promise<string | null> {
		return this.recentStreamerUsername;
	}
}

class FakeRegistry {
	readonly sessionTabIds = new Map<number, number>();

	async getSessionTabId(tiktokTabId: number): Promise<number | null> {
		return this.sessionTabIds.get(tiktokTabId) ?? null;
	}
}
