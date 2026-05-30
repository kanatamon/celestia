/// <reference types="chrome" />

import { ChromeExtensionTikTokLiveProvider } from '@celestia/tiktok-live-chrome-extension';
import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
} from '@celestia/tiktok-live-core';
import { ActivitySwitcher, SplitFeedLayout, StatusBar, useSoundEffects } from '@celestia/ui';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { userPreferences } from '../user-preferences/user-preferences.js';
import { useLiveEventStore } from './live-event-store.js';
import styles from './side-panel.module.css';

export interface TabObserver {
	getCurrentTab(): Promise<ObservedTab | undefined>;
	navigateCurrentTab(url: string): Promise<void>;
	subscribe(listener: (tab: ObservedTab | undefined) => void): () => void;
}

interface AttachableTikTokLiveProvider extends TikTokLiveProvider {
	attach(tabId: number, username: string, tabUrl?: string): Promise<ConnectionState>;
	exportTraceJson?(): Promise<string | undefined>;
}

interface SidePanelProps {
	tabObserver?: TabObserver;
	providerFactory?: () => AttachableTikTokLiveProvider;
}

interface InspectionConfirmationModalProps {
	candidate: LiveTarget;
	confirmedTarget: LiveTarget | null;
	onConfirm: () => void;
	onDeny: () => void;
}

export interface LiveTarget {
	tabId: number;
	username: string;
	url: string;
	detectedAt: number;
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
const defaultProviderFactory = () => {
	const traceEnabled = isTraceModeEnabled();
	return new ChromeExtensionTikTokLiveProvider({
		diagnostics: {
			enabled: isDiagnosticsModeEnabled(traceEnabled),
		},
		trace: {
			enabled: traceEnabled,
			extensionVersion: getExtensionVersion(),
		},
	});
};

export type CelestiaDevToolsNamespace = {
	enableTrace(): void;
	disableTrace(): void;
	cancel(): void;
	status(): void;
	exportTrace(): Promise<string | undefined>;
};

type CelestiaDevToolsWindow = Window & {
	__CELESTIA__?: CelestiaDevToolsNamespace;
	__CELESTIA_EXPORT_LIVE_TRACE__?: unknown;
};

let activeTraceProvider: AttachableTikTokLiveProvider | undefined;
let pendingTraceReload: number | undefined;
let pendingTraceCountdown: number | undefined;

type TraceReloadAction = 'enable' | 'disable';

const TRACE_RELOAD_DELAY_MS = 3000;
const TRACE_RELOAD_COUNTDOWN_SECONDS = TRACE_RELOAD_DELAY_MS / 1000;
const LEGACY_TRACE_EXPORT_NAME = '__CELESTIA_EXPORT_LIVE_TRACE__';

export function SidePanel({
	tabObserver = defaultTabObserver,
	providerFactory = defaultProviderFactory,
}: SidePanelProps) {
	const setStreamerUsername = useLiveEventStore((state) => state.setStreamerUsername);
	const connectionState = useLiveEventStore((state) => state.connectionState);
	const viewerCount = useLiveEventStore((state) => state.viewerCount);
	const likeCount = useLiveEventStore((state) => state.likeCount);
	const resetSession = useLiveEventStore((state) => state.resetSession);
	const [confirmedTarget, setConfirmedTarget] = useState<LiveTarget | null>(null);
	const confirmedTargetRef = useRef<LiveTarget | null>(null);
	const [activeCandidate, setActiveCandidate] = useState<LiveTarget | null>(null);
	const [deniedCandidateKey, setDeniedCandidateKey] = useState<string | null>(null);
	const [isLandingOpen, setIsLandingOpen] = useState(false);

	useEffect(() => registerDevToolsConsole(), []);

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
				setActiveCandidate(null);
				return;
			}

			console.info('[Celestia Side Panel] detected TikTok Live tab', liveTab);
			const currentTarget = confirmedTargetRef.current;

			if (!currentTarget) {
				setActiveCandidate(liveTab);
				return;
			}

			if (isSameLiveTarget(currentTarget, liveTab)) {
				setActiveCandidate(null);
				return;
			}

			console.info('[Celestia Side Panel] tracking active Live Target candidate', {
				confirmedTarget: currentTarget,
				activeCandidate: liveTab,
			});
			setActiveCandidate(liveTab);
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
	}, [tabObserver]);

	const promptCandidate = getPromptCandidate(activeCandidate, deniedCandidateKey);

	const handleConfirmCandidate = () => {
		if (!promptCandidate) {
			return;
		}

		confirmedTargetRef.current = promptCandidate;
		setConfirmedTarget(promptCandidate);
		setStreamerUsername(promptCandidate.username);
		resetSession();
		setDeniedCandidateKey(null);
		setActiveCandidate(null);
		setIsLandingOpen(false);
	};

	const handleDenyCandidate = () => {
		if (!promptCandidate) {
			return;
		}

		setDeniedCandidateKey(getLiveTargetKey(promptCandidate));
		setActiveCandidate(null);
	};

	const handleUsernameSubmit = async (username: string) => {
		const liveUrl = toTikTokLiveUrl(username);

		if (liveUrl) {
			setIsLandingOpen(false);
			await tabObserver.navigateCurrentTab(liveUrl);
		}
	};

	return (
		<main aria-label="Celestia Side Panel">
			{confirmedTarget && !isLandingOpen ? (
				<LiveFeed
					key={getLiveTargetKey(confirmedTarget)}
					target={confirmedTarget}
					providerFactory={providerFactory}
					onOpenUsernameInput={() => setIsLandingOpen(true)}
					connectionState={connectionState}
					viewerCount={viewerCount}
					likeCount={likeCount}
				/>
			) : (
				<LandingModal onSubmit={handleUsernameSubmit} />
			)}
			{promptCandidate ? (
				<InspectionConfirmationModal
					candidate={promptCandidate}
					confirmedTarget={confirmedTarget}
					onConfirm={handleConfirmCandidate}
					onDeny={handleDenyCandidate}
				/>
			) : null}
		</main>
	);
}

export function parseTikTokLiveUrl(
	url: string | undefined,
): Omit<LiveTarget, 'tabId' | 'detectedAt'> | undefined {
	return parseTikTokLiveUrlParts(url);
}

function parseTikTokLiveTab(tab: ObservedTab | undefined): LiveTarget | undefined {
	if (tab?.id === undefined || !tab.url) {
		return undefined;
	}

	const liveUrl = parseTikTokLiveUrlParts(tab.url);
	if (!liveUrl) {
		return undefined;
	}

	return {
		tabId: tab.id,
		detectedAt: Date.now(),
		...liveUrl,
	};
}

function parseTikTokLiveUrlParts(
	url: string | undefined,
): Omit<LiveTarget, 'tabId' | 'detectedAt'> | undefined {
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

function isSameLiveTarget(first: LiveTarget, second: LiveTarget): boolean {
	return first.tabId === second.tabId && first.url === second.url;
}

function getLiveTargetKey(target: LiveTarget): string {
	return `${target.tabId}:${target.url}`;
}

function getPromptCandidate(
	activeCandidate: LiveTarget | null,
	deniedCandidateKey: string | null,
): LiveTarget | null {
	if (!activeCandidate || getLiveTargetKey(activeCandidate) === deniedCandidateKey) {
		return null;
	}

	return activeCandidate;
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

function InspectionConfirmationModal({
	candidate,
	confirmedTarget,
	onConfirm,
	onDeny,
}: InspectionConfirmationModalProps) {
	const message = getInspectionPromptMessage(candidate, confirmedTarget);

	return (
		<section
			aria-label="Confirm Live Session inspection"
			className={styles.inspectionPromptBackdrop}
			role="dialog"
			aria-modal="true"
		>
			<div className={styles.inspectionPrompt}>
				<p>{message}</p>
				<div className={styles.inspectionPromptActions}>
					<button type="button" onClick={onDeny}>
						Deny
					</button>
					<button type="button" onClick={onConfirm}>
						Confirm
					</button>
				</div>
			</div>
		</section>
	);
}

function getInspectionPromptMessage(
	candidate: LiveTarget,
	confirmedTarget: LiveTarget | null,
): string {
	if (!confirmedTarget) {
		return `Inspect @${candidate.username}'s Live Session?`;
	}

	return `Celestia is watching @${confirmedTarget.username}. Switch to @${candidate.username}?`;
}

function LiveFeed({
	target,
	providerFactory,
	onOpenUsernameInput,
	connectionState,
	viewerCount,
	likeCount,
}: {
	target: LiveTarget;
	providerFactory: () => AttachableTikTokLiveProvider;
	onOpenUsernameInput: () => void;
	connectionState: ConnectionState;
	viewerCount: number;
	likeCount: number;
}) {
	const { tabId, username, url } = target;
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
	const soundEffectEvents = useMemo(
		() => [...chatEvents, ...giftEvents].sort((a, b) => a.ts - b.ts),
		[chatEvents, giftEvents],
	);

	useSoundEffects(soundEffectEvents);

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

		activeTraceProvider = provider;
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

		void provider.attach(tabId, username, url).catch((error: unknown) => {
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
			if (activeTraceProvider === provider) {
				activeTraceProvider = undefined;
			}
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
		url,
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

export function registerDevToolsConsole(provider?: AttachableTikTokLiveProvider): () => void {
	if (provider) {
		activeTraceProvider = provider;
	}

	const globalWindow = window as CelestiaDevToolsWindow;
	delete globalWindow[LEGACY_TRACE_EXPORT_NAME];

	globalWindow.__CELESTIA__ = {
		enableTrace() {
			scheduleTraceReload('enable');
		},
		disableTrace() {
			scheduleTraceReload('disable');
		},
		cancel() {
			cancelPendingTraceReload();
		},
		status() {
			printDevToolsBanner();
		},
		async exportTrace() {
			if (!isTraceModeEnabled()) {
				console.warn(
					'[Celestia Debug Tools] Trace mode is OFF. Run window.__CELESTIA__.enableTrace() and reconnect to a Live Session first.',
				);
				return undefined;
			}

			const traceJson = await activeTraceProvider?.exportTraceJson?.();

			if (!traceJson) {
				console.warn(
					'[Celestia Debug Tools] Trace mode is ON, but no trace events are available. Connect to a Live Session first.',
				);
				return undefined;
			}

			console.info('[Celestia Trace]', traceJson);
			return traceJson;
		},
	};

	printDevToolsBanner();

	return () => {
		clearPendingTraceReload();
		if (provider && activeTraceProvider === provider) {
			activeTraceProvider = undefined;
		}
	};
}

function printDevToolsBanner(): void {
	const traceEnabled = isTraceModeEnabled();

	console.group('%c🔭 Celestia Debug Tools', 'font-weight: 700; color: #7c3aed;');
	console.info(`   Trace mode:  ● ${traceEnabled ? 'ON ✓' : 'OFF'}`);
	console.info('   ──────────────────────────────────────────');
	console.info('   Enable:   window.__CELESTIA__.enableTrace()');
	console.info('   Disable:  window.__CELESTIA__.disableTrace()');
	if (traceEnabled) {
		console.info('   Export:   window.__CELESTIA__.exportTrace()');
	}
	console.info('   Status:   window.__CELESTIA__.status()');
	console.groupEnd();
}

function scheduleTraceReload(action: TraceReloadAction): void {
	clearPendingTraceReload();
	let secondsRemaining = TRACE_RELOAD_COUNTDOWN_SECONDS;
	console.info(
		`[Celestia Debug Tools] ${action === 'enable' ? 'Enabling' : 'Disabling'} trace mode in ${secondsRemaining}s. Run window.__CELESTIA__.cancel() to abort.`,
	);
	pendingTraceCountdown = window.setInterval(() => {
		secondsRemaining -= 1;
		if (secondsRemaining > 0) {
			console.info(`[Celestia Debug Tools] Reloading in ${secondsRemaining}s...`);
		}
	}, 1000);
	pendingTraceReload = window.setTimeout(() => {
		clearPendingTraceReload();
		setTraceModeEnabled(action === 'enable');
		window.location.reload();
	}, TRACE_RELOAD_DELAY_MS);
}

function cancelPendingTraceReload(): void {
	const hadPendingReload = pendingTraceReload !== undefined;
	clearPendingTraceReload();
	if (hadPendingReload) {
		console.info('[Celestia Debug Tools] Pending trace reload canceled.');
	}
}

function clearPendingTraceReload(): void {
	if (pendingTraceCountdown !== undefined) {
		window.clearInterval(pendingTraceCountdown);
		pendingTraceCountdown = undefined;
	}
	if (pendingTraceReload !== undefined) {
		window.clearTimeout(pendingTraceReload);
		pendingTraceReload = undefined;
	}
}

function isTraceModeEnabled(): boolean {
	const params = new URLSearchParams(window.location.search);
	return params.get('celestiaTrace') === '1' || userPreferences.getCachedTraceModeEnabled();
}

function setTraceModeEnabled(enabled: boolean): void {
	void userPreferences.setTraceModeEnabled(enabled);
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
