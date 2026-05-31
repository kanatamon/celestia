/// <reference types="chrome" />

import { userPreferences } from '../user-preferences/user-preferences.js';
import { createSessionCoordinator } from './session-coordinator.js';
import { createTabPairingRegistry } from './tab-pairing-registry.js';

interface OpenLiveSessionMessage {
	type: 'OPEN_LIVE_SESSION';
	username: string;
}

const coordinator = createSessionCoordinator({
	registry: createTabPairingRegistry(),
	tabs: chrome.tabs,
	debugger: chrome.debugger,
	preferences: userPreferences,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!isOpenLiveSessionMessage(message)) {
		return false;
	}

	coordinator
		.openLiveSession(message.username)
		.then((pair) => sendResponse({ ok: true, pair }))
		.catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));

	return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
	void coordinator.handleTabRemoved(tabId);
});

function isOpenLiveSessionMessage(message: unknown): message is OpenLiveSessionMessage {
	if (typeof message !== 'object' || message === null) {
		return false;
	}

	const candidate = message as Record<string, unknown>;
	return candidate.type === 'OPEN_LIVE_SESSION' && typeof candidate.username === 'string';
}
