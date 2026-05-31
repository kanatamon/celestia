/// <reference types="chrome" />

import type { TabPair, TabPairingRegistry } from './tab-pairing-registry.js';

const SESSION_TAB_PATH = 'src/session-tab/index.html';

interface ChromeTabsApi {
	create(props: { url: string }): Promise<{ id?: number }>;
	remove(tabId: number): Promise<void>;
}

interface ChromeDebuggerApi {
	detach(target: { tabId: number }): Promise<void>;
}

interface RecentStreamerPreferences {
	setRecentStreamerUsername(username: string | null): Promise<void>;
}

interface CreateSessionCoordinatorOptions {
	registry: TabPairingRegistry;
	tabs: ChromeTabsApi;
	debugger: ChromeDebuggerApi;
	preferences: RecentStreamerPreferences;
	tiktokLiveUrl?: (username: string) => string;
	sessionTabUrl?: (tiktokTabId: number) => string;
}

/**
 * Coordinates Session Tab lifecycle for the service worker: opening a paired
 * TikTok Live tab + Session Tab on `OPEN_LIVE_SESSION`, and reconciling the Tab
 * Pairing Registry plus the Chrome Debugger when either tab is closed.
 */
export interface SessionCoordinator {
	openLiveSession(username: string): Promise<TabPair>;
	handleTabRemoved(tabId: number): Promise<void>;
}

export function createSessionCoordinator({
	registry,
	tabs,
	debugger: chromeDebugger,
	preferences,
	tiktokLiveUrl = defaultTiktokLiveUrl,
	sessionTabUrl = defaultSessionTabUrl,
}: CreateSessionCoordinatorOptions): SessionCoordinator {
	return {
		async openLiveSession(username) {
			const tiktokTab = await tabs.create({ url: tiktokLiveUrl(username) });
			const tiktokTabId = requireTabId(tiktokTab.id);

			const sessionTab = await tabs.create({ url: sessionTabUrl(tiktokTabId) });
			const sessionTabId = requireTabId(sessionTab.id);

			const pair: TabPair = { tiktokTabId, sessionTabId };
			await registry.setPair(pair);
			await preferences.setRecentStreamerUsername(username);

			return pair;
		},
		async handleTabRemoved(tabId) {
			const closedSessionPair = await registry.findBySessionTabId(tabId);
			if (closedSessionPair) {
				await detachQuietly(chromeDebugger, closedSessionPair.tiktokTabId);
				await registry.removeBySessionTabId(tabId);
				return;
			}

			const pairedSessionTabId = await registry.getSessionTabId(tabId);
			if (pairedSessionTabId !== null) {
				await registry.removeByTiktokTabId(tabId);
			}
		},
	};
}

async function detachQuietly(
	chromeDebugger: ChromeDebuggerApi,
	tiktokTabId: number,
): Promise<void> {
	try {
		await chromeDebugger.detach({ tabId: tiktokTabId });
	} catch {
		// The debugger may already be detached (e.g. the tab navigated away or
		// was never attached). Closing the Session Tab should still clear the pair.
	}
}

function requireTabId(tabId: number | undefined): number {
	if (typeof tabId !== 'number') {
		throw new Error('chrome.tabs.create did not return a tab id');
	}

	return tabId;
}

function defaultTiktokLiveUrl(username: string): string {
	return `https://www.tiktok.com/@${username}/live`;
}

function defaultSessionTabUrl(tiktokTabId: number): string {
	const path = `${SESSION_TAB_PATH}?tiktokTabId=${tiktokTabId}`;
	const runtime = typeof chrome === 'undefined' ? undefined : chrome.runtime;

	return runtime?.getURL ? runtime.getURL(path) : path;
}
