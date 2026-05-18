/// <reference types="chrome" />

import { type FormEvent, useEffect, useState } from 'react';

export interface TabObserver {
	getCurrentUrl(): Promise<string | undefined>;
	navigateCurrentTab(url: string): Promise<void>;
	subscribe(listener: (url: string | undefined) => void): () => void;
}

interface SidePanelProps {
	tabObserver?: TabObserver;
}

interface LiveTab {
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

const defaultTabObserver = createChromeTabObserver();

export function SidePanel({ tabObserver = defaultTabObserver }: SidePanelProps) {
	const [activeLiveTab, setActiveLiveTab] = useState<LiveTab>();

	useEffect(() => {
		let isMounted = true;

		const detectLiveTab = (url: string | undefined) => {
			const liveTab = parseTikTokLiveUrl(url);

			if (!liveTab) {
				return;
			}

			setActiveLiveTab(liveTab);
		};

		tabObserver.getCurrentUrl().then((url) => {
			if (isMounted) {
				detectLiveTab(url);
			}
		});

		const unsubscribe = tabObserver.subscribe(detectLiveTab);

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [tabObserver]);

	const handleUsernameSubmit = async (username: string) => {
		const liveUrl = toTikTokLiveUrl(username);

		if (liveUrl) {
			await tabObserver.navigateCurrentTab(liveUrl);
		}
	};

	return (
		<main aria-label="Celestia Side Panel">
			{activeLiveTab ? (
				<LiveFeed username={activeLiveTab.username} />
			) : (
				<LandingModal onSubmit={handleUsernameSubmit} />
			)}
		</main>
	);
}

export function parseTikTokLiveUrl(url: string | undefined): LiveTab | undefined {
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

function LiveFeed({ username }: { username: string }) {
	return (
		<section aria-label="Live feed">
			<header>
				<strong>@{username}</strong>
				<span>Live feed</span>
			</header>
		</section>
	);
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
			async getCurrentUrl() {
				return undefined;
			},
			async navigateCurrentTab() {},
			subscribe() {
				return noop;
			},
		};
	}

	return {
		async getCurrentUrl() {
			const [tab] = await chromeTabs.query({ active: true, currentWindow: true });
			return tab?.url;
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
				listener(tab?.url);
			};
			const handleUpdated = (
				_tabId: number,
				changeInfo: ObservedTabChangeInfo,
				tab: ObservedTab,
			) => {
				if (tab.active && changeInfo.url) {
					listener(changeInfo.url);
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
