/// <reference types="chrome" />

import { type FormEvent, type ReactElement, useEffect, useState } from 'react';
import {
	createTabPairingRegistry,
	type TabPairingRegistry,
} from '../background/tab-pairing-registry.js';
import {
	type UserPreferencesStore,
	userPreferences,
} from '../user-preferences/user-preferences.js';
import styles from './launcher.module.css';

const liveTabQuery = { url: '*://www.tiktok.com/*/live*' };

interface LauncherChromeApi {
	runtime: {
		sendMessage(message: unknown): Promise<unknown>;
	};
	tabs: {
		query(queryInfo: { url: string }): Promise<LauncherTab[]>;
		update(tabId: number, updateProperties: { active: boolean }): Promise<unknown>;
	};
}

interface LauncherTab {
	id?: number;
	title?: string;
	url?: string;
}

type LauncherTabWithId = LauncherTab & { id: number };

interface LauncherProps {
	chromeApi?: LauncherChromeApi;
	preferences?: Pick<UserPreferencesStore, 'getRecentStreamerUsername'>;
	registry?: Pick<TabPairingRegistry, 'getSessionTabId'>;
	closeWindow?: () => void;
}

interface LiveTabItem {
	id: number;
	title: string;
	username: string | null;
	sessionTabId: number | null;
}

export function Launcher({
	chromeApi = getChromeApi(),
	preferences = userPreferences,
	registry = createTabPairingRegistry(),
	closeWindow = () => window.close(),
}: LauncherProps): ReactElement {
	const [username, setUsername] = useState('');
	const [liveTabs, setLiveTabs] = useState<LiveTabItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;

		async function loadLauncherState() {
			const [recentUsername, tabs] = await Promise.all([
				preferences.getRecentStreamerUsername(),
				chromeApi.tabs.query(liveTabQuery),
			]);

			const items = await Promise.all(
				tabs.filter(hasTabId).map((tab) => toLiveTabItem(tab, registry)),
			);

			if (!isMounted) return;
			setUsername(recentUsername ?? '');
			setLiveTabs(items);
			setIsLoading(false);
		}

		void loadLauncherState();

		return () => {
			isMounted = false;
		};
	}, [chromeApi, preferences, registry]);

	const hasLiveTabs = liveTabs.length > 0;
	const subtitle = hasLiveTabs ? 'Choose an open Live or start another' : 'Start a Live Session';

	async function submitUsername(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedUsername = normalizeUsername(username);
		if (!trimmedUsername) return;

		await chromeApi.runtime.sendMessage({
			type: 'OPEN_LIVE_SESSION',
			username: trimmedUsername,
		});
		closeWindow();
	}

	async function openLiveTab(tab: LiveTabItem) {
		if (tab.sessionTabId !== null) {
			await chromeApi.tabs.update(tab.sessionTabId, { active: true });
			closeWindow();
			return;
		}

		await chromeApi.runtime.sendMessage({
			type: 'OPEN_LIVE_SESSION',
			tiktokTabId: tab.id,
			username: tab.username ?? undefined,
		});
		closeWindow();
	}

	return (
		<main className={styles.launcher} aria-label="Celestia Launcher">
			<section className={styles.content}>
				<header className={styles.header}>
					<p className={styles.kicker}>Celestia</p>
					<h1 className={styles.title}>{subtitle}</h1>
				</header>

				<form className={styles.form} onSubmit={submitUsername}>
					<label className={styles.label} htmlFor="streamer-username">
						Streamer username
					</label>
					<div className={styles.inputRow}>
						<span className={styles.atSign}>@</span>
						<input
							id="streamer-username"
							className={styles.input}
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							placeholder="username"
							autoComplete="off"
						/>
					</div>
				</form>

				{hasLiveTabs ? (
					<ul className={styles.liveList} aria-label="Open TikTok Live tabs">
						{liveTabs.map((tab) => (
							<li key={tab.id}>
								<button
									type="button"
									className={styles.liveButton}
									onClick={() => void openLiveTab(tab)}
								>
									<span
										className={tab.sessionTabId === null ? styles.unpairedDot : styles.pairedDot}
										aria-hidden="true"
									/>
									<span className={styles.liveCopy}>
										<span className={styles.liveTitle}>{tab.username ?? tab.title}</span>
										<span className={styles.liveMeta}>
											{tab.sessionTabId === null ? 'Open Session Tab' : 'Session Tab open'}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				) : (
					<p className={styles.empty}>
						{isLoading ? 'Loading open lives' : 'No open TikTok Live tabs'}
					</p>
				)}
			</section>
		</main>
	);
}

function normalizeUsername(username: string): string {
	return username.trim().replace(/^@+/, '');
}

function hasTabId(tab: LauncherTab): tab is LauncherTabWithId {
	return typeof tab.id === 'number';
}

async function toLiveTabItem(
	tab: LauncherTabWithId,
	registry: Pick<TabPairingRegistry, 'getSessionTabId'>,
): Promise<LiveTabItem> {
	const tabUsername = usernameFromUrl(tab.url);

	return {
		id: tab.id,
		title: tab.title || tabUsername || 'TikTok Live',
		username: tabUsername,
		sessionTabId: await registry.getSessionTabId(tab.id),
	};
}

function usernameFromUrl(url: string | undefined): string | null {
	if (!url) return null;

	const match = /tiktok\.com\/@([^/?#]+)\/live/.exec(url);
	return match?.[1] ?? null;
}

function getChromeApi(): LauncherChromeApi {
	if (typeof chrome === 'undefined') {
		throw new Error('Celestia Launcher requires the Chrome extension API.');
	}

	return chrome;
}
