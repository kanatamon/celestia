/// <reference types="chrome" />

import { ChromeExtensionTikTokLiveProvider } from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
} from '@celestia/tiktok-live-core';
import {
	ActivitySwitcher,
	GiftCelebration,
	SplitFeedLayout,
	StatusBar,
	useSoundEffects,
} from '@celestia/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { userPreferences } from '../user-preferences/user-preferences.js';
import { createLiveEventStore, type LiveEventStore } from './live-event-store.js';
import styles from './session-tab.module.css';

interface AttachableTikTokLiveProvider extends TikTokLiveProvider {
	attach(tabId: number, username: string, tabUrl?: string): Promise<ConnectionState>;
	exportTraceJson?(): Promise<string | undefined>;
}

interface ResolvedTab {
	url?: string;
}

type LiveEventStoreApi = ReturnType<typeof createLiveEventStore>;

const SAMPLE_GIFT_ANIMATION_URL = '/src/session-tab/assets/sample-gift-animation.mp4';

interface SessionTabProps {
	/** The TikTok Live tab this Session Tab is paired to, from `?tiktokTabId=<id>`. */
	tiktokTabId: number;
	providerFactory?: () => AttachableTikTokLiveProvider;
	resolveTab?: (tabId: number) => Promise<ResolvedTab | undefined>;
	watchTabClosed?: (tabId: number, listener: () => void) => () => void;
}

const defaultProviderFactory = (): AttachableTikTokLiveProvider => {
	const traceEnabled = isTraceModeEnabled();
	return new ChromeExtensionTikTokLiveProvider({
		diagnostics: { enabled: isDiagnosticsModeEnabled(traceEnabled) },
		trace: { enabled: traceEnabled, extensionVersion: getExtensionVersion() },
	});
};

export function SessionTab({
	tiktokTabId,
	providerFactory = defaultProviderFactory,
	resolveTab = defaultResolveTab,
	watchTabClosed = defaultWatchTabClosed,
}: SessionTabProps) {
	const store = useMemo(
		() => createLiveEventStore({ name: `celestia-live-event-store-${tiktokTabId}` }),
		[tiktokTabId],
	);

	if (!Number.isInteger(tiktokTabId)) {
		return (
			<main aria-label="Celestia Session Tab" className={styles.sessionTab}>
				<DisconnectedBanner
					title="No live session"
					message="This Session Tab was opened without a paired TikTok Live tab."
				/>
			</main>
		);
	}

	return (
		<LiveFeed
			key={tiktokTabId}
			store={store}
			tiktokTabId={tiktokTabId}
			providerFactory={providerFactory}
			resolveTab={resolveTab}
			watchTabClosed={watchTabClosed}
		/>
	);
}

function LiveFeed({
	store,
	tiktokTabId,
	providerFactory,
	resolveTab,
	watchTabClosed,
}: {
	store: LiveEventStoreApi;
	tiktokTabId: number;
	providerFactory: () => AttachableTikTokLiveProvider;
	resolveTab: (tabId: number) => Promise<ResolvedTab | undefined>;
	watchTabClosed: (tabId: number, listener: () => void) => () => void;
}) {
	const state = useStore(store);
	const [pairedTabClosed, setPairedTabClosed] = useState(false);
	const [celebrationAssetUrl, setCelebrationAssetUrl] = useState<string | undefined>();
	const clearDevGiftCelebration = useDevGiftCelebrationTrigger(setCelebrationAssetUrl);
	const soundEffectEvents = useMemo(
		() => [...state.chatEvents, ...state.giftEvents].sort((a, b) => a.ts - b.ts),
		[state.chatEvents, state.giftEvents],
	);

	useSoundEffects(soundEffectEvents);

	// Watch the paired TikTok Live tab. The Chrome Extension Provider classifies an
	// external tab close as a transient `error`, so the Session Tab observes the
	// removal directly to render a persistent disconnected state. It never closes
	// itself — the feed stays readable.
	useEffect(() => {
		const unsubscribe = watchTabClosed(tiktokTabId, () => {
			setPairedTabClosed(true);
			const { connectionState, setConnectionState } = store.getState();
			setConnectionState({ status: 'disconnected', username: connectionState.username });
		});

		return unsubscribe;
	}, [store, tiktokTabId, watchTabClosed]);

	useEffect(() => {
		let cancelled = false;
		let provider: AttachableTikTokLiveProvider | undefined;
		let teardown: (() => void) | undefined;

		store.getState().setConnectionState({ status: 'connecting', username: '' });

		void (async () => {
			const tab = await resolveTab(tiktokTabId);
			if (cancelled) return;

			const username = parseTikTokUsername(tab?.url) ?? '';
			store.getState().setStreamerUsername(username);

			try {
				provider = providerFactory();
			} catch (error) {
				console.error('Failed to create Celestia Provider', error);
				store.getState().setConnectionState({
					status: 'error',
					reason: 'interrupted',
					username,
				});
				return;
			}

			const unsubscribeLogs = provider.onLog(logProviderMessage);
			const unsubscribeEvents = provider.onEvent((event) => {
				dispatchLiveEvent(event, store.getState(), username);
			});
			const unsubscribeConnectionState = provider.onConnectionState((connectionState) => {
				const next = connectionState.username ? connectionState : { ...connectionState, username };
				store.getState().setConnectionState(next);
				if (connectionState.viewerCount !== undefined) {
					store.getState().updateViewerCount(connectionState.viewerCount);
				}
			});

			teardown = () => {
				unsubscribeLogs();
				unsubscribeEvents();
				unsubscribeConnectionState();
			};

			await provider.attach(tiktokTabId, username, tab?.url).catch((error: unknown) => {
				console.error('Failed to connect Celestia Provider', error);
				store.getState().setConnectionState({
					status: 'error',
					reason: 'interrupted',
					username,
				});
			});
		})();

		return () => {
			cancelled = true;
			teardown?.();
			const activeProvider = provider;
			if (activeProvider) {
				void activeProvider.disconnect().finally(() => {
					activeProvider.destroy();
				});
			}
		};
	}, [store, tiktokTabId, providerFactory, resolveTab]);

	return (
		<main aria-label="Celestia Session Tab" className={styles.sessionTab}>
			{pairedTabClosed ? (
				<DisconnectedBanner
					title="Stream ended"
					message="The paired TikTok Live tab was closed. This feed is no longer receiving new events."
				/>
			) : null}
			<section aria-label="Live feed" className={styles.liveFeed}>
				<GiftCelebration assetUrl={celebrationAssetUrl} onEnded={clearDevGiftCelebration} />
				<div className={styles.liveFeedContent}>
					<StatusBar
						connectionState={state.connectionState}
						viewerCount={state.viewerCount}
						likeCount={state.likeCount}
						username={state.streamerUsername ?? ''}
					/>
					<SplitFeedLayout
						chatEvents={state.chatEvents}
						giftEvents={state.giftEvents}
						userGiftEvents={state.userGiftEvents}
					/>
					<ActivitySwitcher memberEvents={state.memberEvents} giftEvents={state.giftEvents} />
				</div>
			</section>
		</main>
	);
}

declare global {
	interface Window {
		__celestiaPlayCelebration?: () => Promise<void>;
	}

	interface ImportMetaEnv {
		readonly DEV: boolean;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

function useDevGiftCelebrationTrigger(
	setAssetUrl: (assetUrl: string | undefined) => void,
): () => void {
	const lastAssetUrlRef = useRef<string | undefined>(undefined);
	const clearAssetUrl = useCallback(() => {
		if (lastAssetUrlRef.current) {
			URL.revokeObjectURL(lastAssetUrlRef.current);
			lastAssetUrlRef.current = undefined;
		}
		setAssetUrl(undefined);
	}, [setAssetUrl]);

	useEffect(() => {
		if (!isDevBuild()) {
			delete window.__celestiaPlayCelebration;
			return undefined;
		}

		let active = true;

		window.__celestiaPlayCelebration = async () => {
			clearAssetUrl();

			const response = await fetch(SAMPLE_GIFT_ANIMATION_URL);
			const blob = await response.blob();
			if (!active) {
				return;
			}

			const assetUrl = URL.createObjectURL(blob);
			lastAssetUrlRef.current = assetUrl;
			setAssetUrl(assetUrl);
		};

		return () => {
			active = false;
			delete window.__celestiaPlayCelebration;
			clearAssetUrl();
		};
	}, [clearAssetUrl, setAssetUrl]);

	return clearAssetUrl;
}

function isDevBuild(): boolean {
	return import.meta.env.DEV;
}

function DisconnectedBanner({ title, message }: { title: string; message: string }) {
	return (
		<div role="alert" aria-label="Session disconnected" className={styles.disconnectedBanner}>
			<strong>{title}</strong>
			<p>{message}</p>
		</div>
	);
}

function useStore(store: LiveEventStoreApi): LiveEventStore {
	const [snapshot, setSnapshot] = useState<LiveEventStore>(() => store.getState());

	useEffect(() => {
		setSnapshot(store.getState());
		return store.subscribe(setSnapshot);
	}, [store]);

	return snapshot;
}

function dispatchLiveEvent(event: LiveEvent, actions: LiveEventStore, username: string): void {
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
			actions.setConnectionState({ status: 'disconnected', username });
			break;
		default:
			break;
	}
}

function logProviderMessage(log: ProviderLog): void {
	switch (log.level) {
		case 'debug':
			console.debug('[Celestia Provider]', log.message, log.details ?? {});
			break;
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

export function parseTikTokUsername(url: string | undefined): string | undefined {
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
	return username ? decodeURIComponent(username) : undefined;
}

function isTikTokHost(hostname: string): boolean {
	return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
}

// `chrome.tabs.get` is not part of the minimal ambient chrome typing shared by
// the data-layer package, so reach it through a narrow structural cast.
type TabsWithGet = { get?: (tabId: number) => Promise<ResolvedTab> };

async function defaultResolveTab(tabId: number): Promise<ResolvedTab | undefined> {
	const chromeTabs = typeof chrome === 'undefined' ? undefined : (chrome.tabs as TabsWithGet);
	if (!chromeTabs?.get) {
		return undefined;
	}

	try {
		return await chromeTabs.get(tabId);
	} catch {
		return undefined;
	}
}

function defaultWatchTabClosed(tabId: number, listener: () => void): () => void {
	const chromeTabs = typeof chrome === 'undefined' ? undefined : chrome.tabs;
	if (!chromeTabs?.onRemoved) {
		return () => {};
	}

	const handler = (removedTabId: number) => {
		if (removedTabId === tabId) {
			listener();
		}
	};

	chromeTabs.onRemoved.addListener(handler);
	return () => chromeTabs.onRemoved.removeListener(handler);
}

function isTraceModeEnabled(): boolean {
	const params = new URLSearchParams(window.location.search);
	return params.get('celestiaTrace') === '1' || userPreferences.getCachedTraceModeEnabled();
}

function isDiagnosticsModeEnabled(traceEnabled = isTraceModeEnabled()): boolean {
	const params = new URLSearchParams(window.location.search);
	return traceEnabled || params.get('celestiaDiagnostics') === '1';
}

function getExtensionVersion(): string {
	if (typeof chrome === 'undefined') return '0.0.0';
	const maybeChromeRuntime = chrome as typeof chrome & {
		runtime?: { getManifest?: () => { version?: string } };
	};
	return maybeChromeRuntime.runtime?.getManifest?.().version ?? '0.0.0';
}
