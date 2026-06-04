/// <reference types="chrome" />

import type { GiftAnimationAssetCapturedMessage } from '@celestia/tiktok-live-chrome-extension';
import { ChromeExtensionTikTokLiveProvider } from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LikeLiveEvent,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
} from '@celestia/tiktok-live-core';
import {
	ActivitySwitcher,
	type CapturedCelebration,
	type CelebrationSettings,
	CelebrationStage,
	type ConveyorLiker,
	celebrationSettings,
	HeartbeatConveyor,
	LikeLayer,
	type PushLiker,
	type SpawnLike,
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
	const [isClearDataConfirmOpen, setIsClearDataConfirmOpen] = useState(false);
	const [likeResetKey, setLikeResetKey] = useState(0);
	const hasLiveSessionData = hasClearableLiveSessionData(state);
	const { capture: celebrationCapture, enqueueCapture, onCaptureIngested } = useCelebrationFeed();
	useDevGiftCelebrationTrigger(enqueueCapture);
	const observeGiftForSynthesis = useSynthesizedCelebrationTrigger(enqueueCapture);

	// Like Layer geometry anchors + read-only spawn sink. The sink is fed straight
	// from the Provider's event callback below, mirroring the synthesized-celebration
	// arbiter wiring — it bypasses the live-event store entirely (the store still
	// folds likes into `likeCount`; the liker stream is never persisted).
	const liveFeedRef = useRef<HTMLElement>(null);
	const activityBarRef = useRef<HTMLDivElement>(null);
	const likeCounterRef = useRef<HTMLSpanElement>(null);
	const spawnLikeRef = useRef<SpawnLike | null>(null);
	const handleLikeLayerReady = useCallback((spawn: SpawnLike) => {
		spawnLikeRef.current = spawn;
	}, []);
	const pushLikerRef = useRef<PushLiker | null>(null);
	const handleConveyorReady = useCallback((push: PushLiker) => {
		pushLikerRef.current = push;
	}, []);
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
				if (event.type === 'like') {
					// Read-only Like Layer sink: spawn Heart Floats for this like's
					// delta. This bypasses the live-event store (which still folds the
					// like into `likeCount` via `dispatchLiveEvent` above); the liker
					// stream is never written to `chrome.storage.session`.
					spawnLikeRef.current?.(event.likeCount ?? 1);
					// Same read-only sink, identity half: hand the liker's face to the
					// Heartbeat Conveyor. It buffers the latest liker and commits on its
					// own ~1.2s beat, so a like storm never floods the row. Identity is
					// the face only — no nickname text is shown (CONTEXT.md).
					const liker = toConveyorLiker(event.user);
					if (liker) {
						pushLikerRef.current?.(liker);
					}
				}
				if (event.type === 'gift') {
					// Read-only: feed the synthesized-celebration arbiter the gift's
					// unit value and icon. The live event store is never mutated here.
					//
					// The grace window is stamped with the LOCAL clock (`Date.now()`),
					// NOT the gift's `event.ts`. `event.ts` is TikTok's server
					// `createTime`, but the arbiter's `tick` and `assetCaptured` events
					// are local-clock; mixing the two made the window deadline depend on
					// server↔client skew + ingestion latency, so a late local clock could
					// expire the window before the real asset arrived to claim it — the
					// .mp4 then lost its window and an icon synthesized instead (issue #66).
					// Single-clock by construction here.
					observeGiftForSynthesis({
						kind: 'giftEvent',
						diamondCount: event.diamondCount,
						iconUrl: event.giftImageUrl,
						ts: Date.now(),
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
			<section aria-label="Live feed" className={styles.liveFeed} ref={liveFeedRef}>
				<CelebrationStage capture={celebrationCapture} onCaptureIngested={onCaptureIngested} />
				<LikeLayer
					feedRef={liveFeedRef}
					spawnAnchorRef={activityBarRef}
					targetAnchorRef={likeCounterRef}
					onReady={handleLikeLayerReady}
					resetKey={likeResetKey}
				/>
				<div className={styles.liveFeedContent}>
					<StatusBar
						canClearLiveSessionData={hasLiveSessionData}
						connectionState={state.connectionState}
						viewerCount={state.viewerCount}
						likeCount={state.likeCount}
						onClearLiveSessionData={() => setIsClearDataConfirmOpen(true)}
						username={state.streamerUsername ?? ''}
						likeCounterRef={likeCounterRef}
					/>
					<ClearLiveSessionDataModal
						open={isClearDataConfirmOpen}
						onCancel={() => setIsClearDataConfirmOpen(false)}
						onConfirm={() => {
							store.getState().resetSession();
							// Explicit Like Layer reset: clears in-flight Heart Floats. A
							// bumped key (not watching likeCount hit 0) so it cannot be
							// confused with a genuine 0.
							setLikeResetKey((key) => key + 1);
							setIsClearDataConfirmOpen(false);
						}}
					/>
					<SplitFeedLayout
						chatEvents={state.chatEvents}
						giftEvents={state.giftEvents}
						userGiftEvents={state.userGiftEvents}
					/>
					<div ref={activityBarRef} data-celestia-activity-bar className={styles.activityBar}>
						<div className={styles.activitySwitcherSlot}>
							<ActivitySwitcher memberEvents={state.memberEvents} giftEvents={state.giftEvents} />
						</div>
						{/* The Conveyor sits beside the (shrunken) switcher at the bar's right
						    edge — the same edge the Heart Float peels off from, so the heart
						    visibly originates from the row of liker faces. */}
						<HeartbeatConveyor onReady={handleConveyorReady} resetKey={likeResetKey} />
					</div>
				</div>
			</section>
		</main>
	);
}

function hasClearableLiveSessionData(state: LiveEventStore): boolean {
	return (
		state.chatEvents.length > 0 ||
		state.giftEvents.length > 0 ||
		state.memberEvents.length > 0 ||
		state.viewerCount > 0 ||
		state.likeCount > 0
	);
}

function ClearLiveSessionDataModal({
	open,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	if (!open) return null;

	return (
		<div className={styles.modalBackdrop}>
			<section
				aria-labelledby="clear-live-session-data-title"
				aria-modal="true"
				className={styles.modalPanel}
				role="dialog"
			>
				<div className={styles.modalDangerSignal} aria-hidden="true" />
				<h2 className={styles.modalTitle} id="clear-live-session-data-title">
					Clear Live Session data?
				</h2>
				<p className={styles.modalBody}>
					This removes the visible chat, gifts, members, viewer count, and like count for this
					Session Tab. The Live Session stays connected and new events will continue to appear.
				</p>
				<div className={styles.modalActions}>
					<button className={styles.modalCancelButton} onClick={onCancel} type="button">
						Cancel
					</button>
					<button className={styles.modalDangerButton} onClick={onConfirm} type="button">
						Clear Data
					</button>
				</div>
			</section>
		</div>
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
		DEV: boolean;
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
export function useCelebrationFeed(): {
	capture: CapturedCelebration | undefined;
	enqueueCapture: (capture: CapturedCelebration) => void;
	onCaptureIngested: () => void;
} {
	const pending = useRef<CapturedCelebration[]>([]);
	const [capture, setCapture] = useState<CapturedCelebration | undefined>();
	// Whether the single slot currently holds a not-yet-ingested capture. Tracked
	// in a ref so the drain decision happens OUTSIDE the `setCapture` updater:
	// shifting the buffer inside the updater is an impure side effect that React
	// StrictMode double-invokes, which drained the buffer twice and silently
	// dropped captures (issue #66). The updater below is now a pure value-set.
	const slotFilled = useRef(false);

	const releaseNext = useCallback(() => {
		const next = pending.current.shift();
		slotFilled.current = next !== undefined;
		setCapture(next);
	}, []);

	const enqueueCapture = useCallback(
		(next: CapturedCelebration) => {
			pending.current.push(next);
			// Start draining only when idle; a busy slot is advanced by the stage via
			// `onCaptureIngested` once it ingests the in-flight capture.
			if (!slotFilled.current) {
				releaseNext();
			}
		},
		[releaseNext],
	);

	return { capture, enqueueCapture, onCaptureIngested: releaseNext };
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
	settings: CelebrationSettings = celebrationSettings,
): (event: SynthesizedTriggerEvent) => void {
	const stateRef = useRef<SynthesizedTriggerState>(initialSynthesizedTriggerState);
	const enqueueRef = useRef(enqueueCapture);
	enqueueRef.current = enqueueCapture;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	const observe = useCallback((event: SynthesizedTriggerEvent) => {
		// Read the Celebration Threshold live, so a slider change takes effect on
		// the next qualifying gift without a reload (issue #70).
		const threshold = settingsRef.current.getThreshold();
		const { state, emitted } = reduceSynthesizedTrigger(stateRef.current, event, threshold);
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

/**
 * Project a like's `UserInfo` onto the identity payload the Heartbeat Conveyor
 * needs — the face only. Returns `undefined` for an identity-less like (no id),
 * so the row never seats a faceless ghost; such likes still race the counter and
 * float a Heart. The `id` keys dedupe (a loyal repeat liker breathes in place).
 */
function toConveyorLiker(user: LikeLiveEvent['user']): ConveyorLiker | undefined {
	const id = user?.userId || user?.uniqueId || user?.secUid;
	if (!id) {
		return undefined;
	}
	return { id, avatarUrl: user?.avatarUrl, name: user?.nickname || user?.uniqueId };
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
