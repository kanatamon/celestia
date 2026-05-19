/// <reference types="chrome" />

import { ChromeExtensionTikTokLiveProvider } from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
} from '@celestia/tiktok-live-core';
import { ActivitySwitcher, SplitFeedLayout, StatusBar } from '@celestia/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { useLiveEventStore } from './live-event-store.js';
import styles from './side-panel.module.css';

export interface TabObserver {
	getCurrentTab(): Promise<ObservedTab | undefined>;
	navigateCurrentTab(url: string): Promise<void>;
	subscribe(listener: (tab: ObservedTab | undefined) => void): () => void;
}

interface AttachableTikTokLiveProvider extends TikTokLiveProvider {
	attach(tabId: number, username: string): Promise<ConnectionState>;
}

interface SidePanelProps {
	tabObserver?: TabObserver;
	providerFactory?: () => AttachableTikTokLiveProvider;
}

interface LiveTab {
	tabId: number;
	username: string;
	url: string;
}

interface ObservedTab {
	active?: boolean;
	id?: number;
	url?: string;
}

interface ObservedTabChangeInfo {
	url?: string;
}

type LiveEventStoreState = ReturnType<typeof useLiveEventStore.getState>;
type LiveEventDispatchActions = Pick<
	LiveEventStoreState,
	| 'addChatEvent'
	| 'addGiftEvent'
	| 'addMemberEvent'
	| 'updateViewerCount'
	| 'updateLikeCount'
	| 'setConnectionState'
>;

const defaultTabObserver = createChromeTabObserver();
const defaultProviderFactory = () => new ChromeExtensionTikTokLiveProvider();

export function SidePanel({
	tabObserver = defaultTabObserver,
	providerFactory = defaultProviderFactory,
}: SidePanelProps) {
	const streamerUsername = useLiveEventStore((state) => state.streamerUsername);
	const setStreamerUsername = useLiveEventStore((state) => state.setStreamerUsername);
	const connectionState = useLiveEventStore((state) => state.connectionState);
	const viewerCount = useLiveEventStore((state) => state.viewerCount);
	const likeCount = useLiveEventStore((state) => state.likeCount);
	const [streamerTabId, setStreamerTabId] = useState<number | null>(null);
	const [isLandingOpen, setIsLandingOpen] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const detectLiveTab = (tab: ObservedTab | undefined) => {
			console.debug('[Celestia Side Panel] observed active tab', {
				tabId: tab?.id,
				url: tab?.url,
			});
			const liveTab = parseTikTokLiveTab(tab);

			if (!liveTab) {
				console.debug('[Celestia Side Panel] active tab is not a TikTok Live URL');
				return;
			}

			console.info('[Celestia Side Panel] detected TikTok Live tab', liveTab);
			setStreamerTabId(liveTab.tabId);
			setStreamerUsername(liveTab.username);
		};

		tabObserver.getCurrentTab().then((tab) => {
			if (isMounted) {
				detectLiveTab(tab);
			}
		});

		const unsubscribe = tabObserver.subscribe(detectLiveTab);

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [setStreamerUsername, tabObserver]);

	const handleUsernameSubmit = async (username: string) => {
		const liveUrl = toTikTokLiveUrl(username);

		if (liveUrl) {
			setIsLandingOpen(false);
			await tabObserver.navigateCurrentTab(liveUrl);
		}
	};

	return (
		<main aria-label="Celestia Side Panel">
			{streamerUsername && streamerTabId !== null && !isLandingOpen ? (
				<LiveFeed
					username={streamerUsername}
					tabId={streamerTabId}
					providerFactory={providerFactory}
					onOpenUsernameInput={() => setIsLandingOpen(true)}
					connectionState={connectionState}
					viewerCount={viewerCount}
					likeCount={likeCount}
				/>
			) : (
				<LandingModal onSubmit={handleUsernameSubmit} />
			)}
		</main>
	);
}

export function parseTikTokLiveUrl(url: string | undefined): Omit<LiveTab, 'tabId'> | undefined {
	return parseTikTokLiveUrlParts(url);
}

function parseTikTokLiveTab(tab: ObservedTab | undefined): LiveTab | undefined {
	if (tab?.id === undefined || !tab.url) {
		return undefined;
	}

	const liveUrl = parseTikTokLiveUrlParts(tab.url);
	if (!liveUrl) {
		return undefined;
	}

	return {
		tabId: tab.id,
		...liveUrl,
	};
}

function parseTikTokLiveUrlParts(url: string | undefined): Omit<LiveTab, 'tabId'> | undefined {
	if (!url) {
		return undefined;
	}

	let parsedUrl: URL;

	try {
		parsedUrl = new URL(url);
	} catch {
		return undefined;
	}

	if (parsedUrl.protocol !== 'https:' || !isTikTokHost(parsedUrl.hostname)) {
		return undefined;
	}

	const [, username] = /^\/@([^/]+)\/live\/?$/.exec(parsedUrl.pathname) ?? [];

	if (!username) {
		return undefined;
	}

	return {
		username: decodeURIComponent(username),
		url: parsedUrl.toString(),
	};
}

function LandingModal({ onSubmit }: { onSubmit: (username: string) => void | Promise<void> }) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const username = formData.get('username');

		if (typeof username === 'string') {
			void onSubmit(username);
		}
	};

	return (
		<section aria-label="Open TikTok Live">
			<form onSubmit={handleSubmit}>
				<label htmlFor="username">TikTok username</label>
				<input id="username" name="username" type="text" />
				<button type="submit">Open Live</button>
			</form>
		</section>
	);
}

function LiveFeed({
	username,
	tabId,
	providerFactory,
	onOpenUsernameInput,
	connectionState,
	viewerCount,
	likeCount,
}: {
	username: string;
	tabId: number;
	providerFactory: () => AttachableTikTokLiveProvider;
	onOpenUsernameInput: () => void;
	connectionState: ConnectionState;
	viewerCount: number;
	likeCount: number;
}) {
	const addChatEvent = useLiveEventStore((state) => state.addChatEvent);
	const addGiftEvent = useLiveEventStore((state) => state.addGiftEvent);
	const addMemberEvent = useLiveEventStore((state) => state.addMemberEvent);
	const updateViewerCount = useLiveEventStore((state) => state.updateViewerCount);
	const updateLikeCount = useLiveEventStore((state) => state.updateLikeCount);
	const setConnectionState = useLiveEventStore((state) => state.setConnectionState);
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const giftEvents = useLiveEventStore((state) => state.giftEvents);
	const memberEvents = useLiveEventStore((state) => state.memberEvents);
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);

	useEffect(() => {
		let provider: AttachableTikTokLiveProvider;

		console.info('[Celestia Side Panel] starting Provider', { username });
		setConnectionState({ status: 'connecting', username });

		try {
			provider = providerFactory();
		} catch (error) {
			console.error('Failed to create Celestia Provider', error);
			setConnectionState({
				status: 'error',
				reason: 'interrupted',
				username,
			});
			return;
		}

		const unsubscribeLogs = provider.onLog((log) => {
			logProviderMessage(log);
		});
		const unsubscribeEvents = provider.onEvent((event) => {
			console.debug('[Celestia Side Panel] received LiveEvent', {
				id: event.id,
				type: event.type,
			});
			dispatchLiveEvent(event, {
				addChatEvent,
				addGiftEvent,
				addMemberEvent,
				updateViewerCount,
				updateLikeCount,
				setConnectionState,
				username,
			});
		});
		const unsubscribeConnectionState = provider.onConnectionState((state) => {
			console.info('[Celestia Side Panel] Provider connection state', state);
			setConnectionState(state.username ? state : { ...state, username });
			if (state.viewerCount !== undefined) {
				updateViewerCount(state.viewerCount);
			}
		});

		void provider.attach(tabId, username).catch((error: unknown) => {
			console.error('Failed to connect Celestia Provider', error);
			setConnectionState({
				status: 'error',
				reason: 'interrupted',
				username,
			});
		});

		return () => {
			console.info('[Celestia Side Panel] stopping Provider', { username });
			unsubscribeLogs();
			unsubscribeEvents();
			unsubscribeConnectionState();
			void provider.disconnect().finally(() => {
				provider.destroy();
			});
		};
	}, [
		addChatEvent,
		addGiftEvent,
		addMemberEvent,
		providerFactory,
		setConnectionState,
		updateLikeCount,
		updateViewerCount,
		username,
		tabId,
	]);

	return (
		<section aria-label="Live feed" className={styles.liveFeed}>
			<StatusBar
				connectionState={connectionState}
				viewerCount={viewerCount}
				likeCount={likeCount}
				username={username}
				onOpenUsernameInput={onOpenUsernameInput}
			/>
			<header className={styles.liveFeedHeader}>
				<strong>@{username}</strong>
				<span>Live feed</span>
			</header>
			<SplitFeedLayout
				chatEvents={chatEvents}
				giftEvents={giftEvents}
				userGiftEvents={userGiftEvents}
			/>
			<ActivitySwitcher memberEvents={memberEvents} giftEvents={giftEvents} />
		</section>
	);
}

function dispatchLiveEvent(
	event: LiveEvent,
	actions: LiveEventDispatchActions & { username: string },
) {
	switch (event.type) {
		case 'chat':
			actions.addChatEvent(event);
			break;
		case 'gift':
			actions.addGiftEvent(event);
			break;
		case 'member':
			actions.addMemberEvent(event);
			break;
		case 'viewer_count':
			actions.updateViewerCount(event);
			break;
		case 'like':
			actions.updateLikeCount(event);
			break;
		case 'stream_end':
			actions.setConnectionState({ status: 'disconnected', username: actions.username });
			break;
		default:
			break;
	}
}

function logProviderMessage(log: ProviderLog): void {
	switch (log.level) {
		case 'error':
			console.error('[Celestia Provider]', log.message, log.details ?? {});
			break;
		case 'warn':
			console.warn('[Celestia Provider]', log.message, log.details ?? {});
			break;
		default:
			console.info('[Celestia Provider]', log.message, log.details ?? {});
			break;
	}
}

function toTikTokLiveUrl(input: string): string | undefined {
	const username = input.trim().replace(/^@+/, '').trim();

	if (!username) {
		return undefined;
	}

	return `https://www.tiktok.com/@${encodeURIComponent(username)}/live`;
}

function createChromeTabObserver(): TabObserver {
	const chromeTabs = typeof chrome === 'undefined' ? undefined : chrome.tabs;
	const noop = () => {};

	if (!chromeTabs) {
		return {
			async getCurrentTab() {
				return undefined;
			},
			async navigateCurrentTab() {},
			subscribe() {
				return noop;
			},
		};
	}

	return {
		async getCurrentTab() {
			const [tab] = await chromeTabs.query({ active: true, currentWindow: true });
			return tab;
		},
		async navigateCurrentTab(url) {
			const [tab] = await chromeTabs.query({ active: true, currentWindow: true });

			if (tab?.id !== undefined) {
				await chromeTabs.update(tab.id, { url });
			}
		},
		subscribe(listener) {
			const handleActivated = async () => {
				const [tab] = await chromeTabs.query({ active: true, currentWindow: true });
				listener(tab);
			};
			const handleUpdated = (
				_tabId: number,
				changeInfo: ObservedTabChangeInfo,
				tab: ObservedTab,
			) => {
				if (tab.active && changeInfo.url) {
					listener(tab);
				}
			};

			chromeTabs.onActivated.addListener(handleActivated);
			chromeTabs.onUpdated.addListener(handleUpdated);

			return () => {
				chromeTabs.onActivated.removeListener(handleActivated);
				chromeTabs.onUpdated.removeListener(handleUpdated);
			};
		},
	};
}

function isTikTokHost(hostname: string): boolean {
	return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
}
