/// <reference types="chrome" />

import type { GiftAnimationAssetCapturedMessage } from '@celestia/tiktok-live-chrome-extension';
import { ChromeExtensionTikTokLiveProvider } from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
} from '@celestia/tiktok-live-core';
import {
	ActivitySwitcher,
	type CapturedCelebration,
	CelebrationStage,
	SplitFeedLayout,
	StatusBar,
	useSoundEffects,
} from '@celestia/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { userPreferences } from '../user-preferences/user-preferences.js';
import {
	subscribeGiftAnimationAssets,
	toCapturedCelebration,
} from './gift-animation-asset-receiver.js';
import { createLiveEventStore, type LiveEventStore } from './live-event-store.js';
import styles from './session-tab.module.css';
import {
	initialSynthesizedTriggerState,
	reduceSynthesizedTrigger,
	type SynthesizedTriggerEvent,
	type SynthesizedTriggerState,
} from './synthesized-celebration-trigger.js';

/** Tick cadence that expires grace windows; finer than the window so latency stays low. */
const SYNTHESIZED_TICK_MS = 200;

type SubscribeAssets = (onAsset: (asset: GiftAnimationAssetCapturedMessage) => void) => () => void;

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
	subscribeAssets?: SubscribeAssets;
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
	subscribeAssets = subscribeGiftAnimationAssets,
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
			subscribeAssets={subscribeAssets}
		/>
	);
}

function LiveFeed({
	store,
	tiktokTabId,
	providerFactory,
	resolveTab,
	watchTabClosed,
	subscribeAssets,
}: {
	store: LiveEventStoreApi;
	tiktokTabId: number;
	providerFactory: () => AttachableTikTokLiveProvider;
	resolveTab: (tabId: number) => Promise<ResolvedTab | undefined>;
	watchTabClosed: (tabId: number, listener: () => void) => () => void;
	subscribeAssets: SubscribeAssets;
}) {
	const state = useStore(store);
	const [pairedTabClosed, setPairedTabClosed] = useState(false);
	const { capture: celebrationCapture, enqueueCapture, onCaptureIngested } = useCelebrationFeed();
	useDevGiftCelebrationTrigger(enqueueCapture);
	const observeGiftForSynthesis = useSynthesizedCelebrationTrigger(enqueueCapture);
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

	// Subscribe to routed Gift Animation Assets (ADR-0006) and celebrate them
	// (ADR-0005). Each captured asset mints an object URL in this Session Tab's
	// context from the delivered bytes and is enqueued into the celebration
	// queue via `CelebrationStage`, which owns the URL lifecycle (revoking on
	// clip end or drop). A gift with no animation never delivers bytes, so it
	// simply does not celebrate. Nothing is retained after playback.
	useEffect(() => {
		return subscribeAssets((asset) => {
			// An asset capture both plays an Animated celebration and claims the
			// oldest pending synthesized grace window (that gift was animated).
			observeGiftForSynthesis({ kind: 'assetCaptured', ts: Date.now() });
			enqueueCapture(toCapturedCelebration(asset));
		});
	}, [subscribeAssets, enqueueCapture, observeGiftForSynthesis]);

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
				if (event.type === 'gift') {
					// Read-only: feed the synthesized-celebration arbiter the gift's
					// unit value and icon. The live event store is never mutated here.
					observeGiftForSynthesis({
						kind: 'giftEvent',
						diamondCount: event.diamondCount,
						iconUrl: event.giftImageUrl,
						ts: event.ts,
					});
				}
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
	}, [store, tiktokTabId, providerFactory, resolveTab, observeGiftForSynthesis]);

	return (
		<main aria-label="Celestia Session Tab" className={styles.sessionTab}>
			{pairedTabClosed ? (
				<DisconnectedBanner
					title="Stream ended"
					message="The paired TikTok Live tab was closed. This feed is no longer receiving new events."
				/>
			) : null}
			<section aria-label="Live feed" className={styles.liveFeed}>
				<CelebrationStage capture={celebrationCapture} onCaptureIngested={onCaptureIngested} />
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
		/**
		 * Dev self-trigger: captures the sample Gift Animation Asset and feeds it
		 * into the celebration queue. Call repeatedly in quick succession to watch
		 * one-at-a-time playback and bounded-queue dropping. Pass a shared `assetId`
		 * across calls to watch identical-asset coalescing; omit it to mint a fresh
		 * id per call (the byte-identical sample would otherwise always coalesce).
		 */
		__celestiaPlayCelebration?: (assetId?: string) => Promise<void>;
		/**
		 * Dev self-trigger for a **Synthesized Gift Celebration** (ADR-0007): feeds
		 * a remote Gift Icon URL into the celebration queue, so the synthesized
		 * render path is demoable without the real event trigger. The URL is remote
		 * and shared, so `CelebrationStage` never revokes it.
		 */
		__celestiaPlaySynthesizedCelebration?: (giftImageUrl: string, assetId?: string) => void;
	}

	interface ImportMetaEnv {
		readonly DEV: boolean;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}

/**
 * Buffers captured assets and hands `CelebrationStage` exactly one at a time.
 * A real burst delivers several captures in quick succession (and tests fire
 * them synchronously); React would otherwise collapse them into a single state
 * value and the queue would never see the intermediate captures — leaking their
 * object URLs and breaking coalesce/drop. `capture` is a single-slot pulse the
 * stage ingests once; `onCaptureIngested` (fired by the stage once per capture)
 * releases the next buffered item into that slot, so every capture reaches the
 * queue on its own render.
 */
function useCelebrationFeed(): {
	capture: CapturedCelebration | undefined;
	enqueueCapture: (capture: CapturedCelebration) => void;
	onCaptureIngested: () => void;
} {
	const pending = useRef<CapturedCelebration[]>([]);
	const [capture, setCapture] = useState<CapturedCelebration | undefined>();

	const enqueueCapture = useCallback((next: CapturedCelebration) => {
		pending.current.push(next);
		// Start draining only when idle; otherwise the in-flight head advances it.
		setCapture((current) => current ?? pending.current.shift());
	}, []);

	const onCaptureIngested = useCallback(() => {
		setCapture(pending.current.shift());
	}, []);

	return { capture, enqueueCapture, onCaptureIngested };
}

/**
 * Wires the pure Synthesized Gift Celebration arbiter (ADR-0007) into the
 * Session Tab. Returns a single `observe` sink the caller feeds `giftEvent` and
 * `assetCaptured` events; an internal timer supplies `tick`s that expire grace
 * windows. Arbiter state lives in a ref so observing is allocation-light and
 * order-preserving, and so the timer can drain windows without re-rendering.
 * When a window expires, a synthesized capture is enqueued keyed by its icon
 * URL (so the queue coalesces a run of the same gift). The giver never reaches
 * here — anonymity is preserved by construction (ADR-0007 §1).
 */
function useSynthesizedCelebrationTrigger(
	enqueueCapture: (capture: CapturedCelebration) => void,
): (event: SynthesizedTriggerEvent) => void {
	const stateRef = useRef<SynthesizedTriggerState>(initialSynthesizedTriggerState);
	const enqueueRef = useRef(enqueueCapture);
	enqueueRef.current = enqueueCapture;

	const observe = useCallback((event: SynthesizedTriggerEvent) => {
		const { state, emitted } = reduceSynthesizedTrigger(stateRef.current, event);
		stateRef.current = state;
		for (const { iconUrl } of emitted) {
			enqueueRef.current({ kind: 'synthesized', assetId: iconUrl, giftImageUrl: iconUrl });
		}
	}, []);

	// Drive grace-window expiry. A tick finer than the window keeps the synthesized
	// celebration close behind the gift while still being best-effort (ADR-0005 §4).
	useEffect(() => {
		const interval = setInterval(
			() => observe({ kind: 'tick', now: Date.now() }),
			SYNTHESIZED_TICK_MS,
		);
		return () => clearInterval(interval);
	}, [observe]);

	return observe;
}

function useDevGiftCelebrationTrigger(
	enqueueCapture: (capture: CapturedCelebration) => void,
): void {
	useEffect(() => {
		if (!isDevBuild()) {
			delete window.__celestiaPlayCelebration;
			return undefined;
		}

		let active = true;
		let sequence = 0;

		window.__celestiaPlayCelebration = async (assetId?: string) => {
			const response = await fetch(SAMPLE_GIFT_ANIMATION_URL);
			const blob = await response.blob();
			if (!active) {
				return;
			}

			// Each capture mints its own object URL; CelebrationStage revokes it when
			// the clip ends, is dropped past the cap, or coalesces into a running clip.
			const assetUrl = URL.createObjectURL(blob);
			sequence += 1;
			enqueueCapture({ kind: 'animated', assetId: assetId ?? `dev-${sequence}`, assetUrl });
		};

		// Synthesized path: the Gift Icon URL is remote — no object URL is minted,
		// and CelebrationStage never revokes it.
		window.__celestiaPlaySynthesizedCelebration = (giftImageUrl: string, assetId?: string) => {
			if (!active) {
				return;
			}
			sequence += 1;
			enqueueCapture({
				kind: 'synthesized',
				assetId: assetId ?? `dev-synth-${sequence}`,
				giftImageUrl,
			});
		};

		return () => {
			active = false;
			delete window.__celestiaPlayCelebration;
			delete window.__celestiaPlaySynthesizedCelebration;
		};
	}, [enqueueCapture]);
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
