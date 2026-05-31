/// <reference types="chrome" />

import { userPreferences } from '../user-preferences/user-preferences.js';
import { createSessionCoordinator, type OpenLiveSessionRequest } from './session-coordinator.js';
import { createTabPairingRegistry } from './tab-pairing-registry.js';

type OpenLiveSessionMessage =
	| { type: 'OPEN_LIVE_SESSION'; username: string; tiktokTabId?: undefined }
	| { type: 'OPEN_LIVE_SESSION'; username?: string; tiktokTabId: number };

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
		.openLiveSession(toOpenLiveSessionRequest(message))
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
	if (candidate.type !== 'OPEN_LIVE_SESSION') {
		return false;
	}

	const hasUsername = typeof candidate.username === 'string';
	const hasTiktokTabId = typeof candidate.tiktokTabId === 'number';
	const hasInvalidUsername = candidate.username !== undefined && !hasUsername;
	const hasInvalidTiktokTabId = candidate.tiktokTabId !== undefined && !hasTiktokTabId;

	return (hasUsername || hasTiktokTabId) && !hasInvalidUsername && !hasInvalidTiktokTabId;
}

function toOpenLiveSessionRequest(message: OpenLiveSessionMessage): OpenLiveSessionRequest {
	if (typeof message.tiktokTabId === 'number') {
		return { tiktokTabId: message.tiktokTabId, username: message.username };
	}

	if (typeof message.username === 'string') {
		return { username: message.username };
	}

	throw new Error('OPEN_LIVE_SESSION message requires a username or TikTok tab id.');
}
