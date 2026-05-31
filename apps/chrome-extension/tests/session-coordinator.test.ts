import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionCoordinator } from '../src/background/session-coordinator.js';
import { createTabPairingRegistry } from '../src/background/tab-pairing-registry.js';

describe('session coordinator', () => {
	let storageArea: FakeChromeSessionStorageArea;
	let tabs: FakeChromeTabs;
	let chromeDebugger: FakeChromeDebugger;
	let preferences: FakePreferences;

	beforeEach(() => {
		storageArea = new FakeChromeSessionStorageArea();
		tabs = new FakeChromeTabs();
		chromeDebugger = new FakeChromeDebugger();
		preferences = new FakePreferences();
	});

	function createCoordinator() {
		return createSessionCoordinator({
			registry: createTabPairingRegistry(storageArea),
			tabs,
			debugger: chromeDebugger,
			preferences,
		});
	}

	it('opens a tiktok live tab and paired session tab and writes the pair on OPEN_LIVE_SESSION', async () => {
		const coordinator = createCoordinator();

		const pair = await coordinator.openLiveSession('celestia');

		const tiktokTab = tabs.created[0];
		const sessionTab = tabs.created[1];

		expect(tiktokTab?.url).toBe('https://www.tiktok.com/@celestia/live');
		expect(sessionTab?.url).toContain(`?tiktokTabId=${tiktokTab?.id}`);
		expect(pair).toEqual({ tiktokTabId: tiktokTab?.id, sessionTabId: sessionTab?.id });

		const registry = createTabPairingRegistry(storageArea);
		await expect(registry.getSessionTabId(tiktokTab?.id as number)).resolves.toBe(sessionTab?.id);
	});

	it('writes the username to User Preferences as recentStreamerUsername', async () => {
		const coordinator = createCoordinator();

		await coordinator.openLiveSession('celestia');

		expect(preferences.recentStreamerUsername).toBe('celestia');
	});

	it('detaches the debugger from the paired tiktok tab and removes the pair when the session tab is closed', async () => {
		const coordinator = createCoordinator();
		const { tiktokTabId, sessionTabId } = await coordinator.openLiveSession('celestia');

		await coordinator.handleTabRemoved(sessionTabId);

		expect(chromeDebugger.detached).toEqual([{ tabId: tiktokTabId }]);
		const registry = createTabPairingRegistry(storageArea);
		await expect(registry.getSessionTabId(tiktokTabId)).resolves.toBeNull();
	});

	it('removes the pair without detaching or closing the session tab when the tiktok tab is closed', async () => {
		const coordinator = createCoordinator();
		const { tiktokTabId, sessionTabId } = await coordinator.openLiveSession('celestia');

		await coordinator.handleTabRemoved(tiktokTabId);

		expect(chromeDebugger.detached).toEqual([]);
		expect(tabs.removed).toEqual([]);
		const registry = createTabPairingRegistry(storageArea);
		await expect(registry.findBySessionTabId(sessionTabId)).resolves.toBeNull();
	});

	it('ignores removal of an unknown tab', async () => {
		const coordinator = createCoordinator();
		await coordinator.openLiveSession('celestia');

		await coordinator.handleTabRemoved(99999);

		expect(chromeDebugger.detached).toEqual([]);
		const registry = createTabPairingRegistry(storageArea);
		await expect(registry.listPairs()).resolves.toHaveLength(1);
	});
});

class FakeChromeSessionStorageArea {
	readonly values = new Map<string, unknown>();

	async get(key: string): Promise<Record<string, unknown>> {
		return { [key]: this.values.get(key) };
	}

	async set(items: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(items)) {
			this.values.set(key, value);
		}
	}

	async remove(key: string): Promise<void> {
		this.values.delete(key);
	}
}

class FakeChromeTabs {
	readonly created: { id: number; url: string }[] = [];
	readonly removed: number[] = [];
	private nextId = 100;

	async create(props: { url: string }): Promise<{ id: number; url: string }> {
		const tab = { id: this.nextId++, url: props.url };
		this.created.push(tab);
		return tab;
	}

	async remove(tabId: number): Promise<void> {
		this.removed.push(tabId);
	}
}

class FakeChromeDebugger {
	readonly detached: { tabId: number }[] = [];

	async detach(target: { tabId: number }): Promise<void> {
		this.detached.push(target);
	}
}

class FakePreferences {
	recentStreamerUsername: string | null = null;

	async setRecentStreamerUsername(username: string | null): Promise<void> {
		this.recentStreamerUsername = username;
	}
}
