import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { manifestDefinition } from '../manifest.config.js';
import { SidePanel, type TabObserver } from '../src/side-panel/side-panel.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Chrome extension scaffold', () => {
	it('declares the Side Panel and background service worker in the MV3 manifest', () => {
		expect(manifestDefinition.manifest_version).toBe(3);
		expect(manifestDefinition.permissions).toContain('sidePanel');
		expect(manifestDefinition.permissions).toContain('tabs');
		expect(manifestDefinition.side_panel.default_path).toBe('src/side-panel/index.html');
		expect(manifestDefinition.background.service_worker).toBe('src/background/service-worker.ts');
	});

	it('renders the Side Panel landmark for the React entry point', () => {
		const html = renderToString(<SidePanel />);

		expect(html).toContain('aria-label="Celestia Side Panel"');
	});

	it('navigates to a TikTok Live URL from the landing modal', async () => {
		const tabObserver = new FakeTabObserver('https://example.com/');
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} />);
		});

		const input = container.querySelector('input[name="username"]');
		const form = container.querySelector('form');

		expect(input).toBeInstanceOf(HTMLInputElement);
		expect(form).toBeInstanceOf(HTMLFormElement);

		await act(async () => {
			(input as HTMLInputElement).value = ' @celestia ';
			input?.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await act(async () => {
			form?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		});

		expect(tabObserver.navigatedUrls).toEqual(['https://www.tiktok.com/@celestia/live']);

		await act(async () => {
			root.unmount();
		});
	});

	it('detects TikTok Live tabs and keeps the feed visible after navigating away', async () => {
		const tabObserver = new FakeTabObserver('https://www.tiktok.com/@first.creator/live');
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<SidePanel tabObserver={tabObserver} />);
		});

		expect(container.textContent).toContain('@first.creator');
		expect(container.textContent).not.toContain('TikTok username');

		await act(async () => {
			tabObserver.emit('https://example.com/not-live');
		});

		expect(container.textContent).toContain('@first.creator');
		expect(container.textContent).not.toContain('TikTok username');

		await act(async () => {
			tabObserver.emit('https://www.tiktok.com/@second_creator/live');
		});

		expect(container.textContent).toContain('@second_creator');

		await act(async () => {
			root.unmount();
		});
	});
});

class FakeTabObserver implements TabObserver {
	readonly navigatedUrls: string[] = [];
	#listener: ((url: string | undefined) => void) | undefined;

	constructor(private url: string | undefined) {}

	async getCurrentUrl(): Promise<string | undefined> {
		return this.url;
	}

	async navigateCurrentTab(url: string): Promise<void> {
		this.navigatedUrls.push(url);
	}

	subscribe(listener: (url: string | undefined) => void): () => void {
		this.#listener = listener;
		return () => {
			this.#listener = undefined;
		};
	}

	emit(url: string | undefined): void {
		this.url = url;
		this.#listener?.(url);
	}
}
