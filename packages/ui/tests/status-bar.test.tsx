import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StatusBar } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('StatusBar', () => {
	it('renders formatted counts, username, and live badge', () => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'connected', username: 'celestia' }}
				viewerCount={12345}
				likeCount={987654}
				username="celestia"
			/>,
		);

		expect(html).toContain('12,345');
		expect(html).toContain('987,654');
		expect(html).toContain('celestia');
		expect(html).toContain('Connection state: Connected');
	});

	it.each([
		['attaching', 'Discovering'],
		['attached', 'Discovering'],
		['connecting', 'Discovering'],
		['detaching', 'Discovering'],
		['disconnecting', 'Discovering'],
		['connected', 'Connected'],
		['error', 'Reconnecting'],
		['detached', 'Stream Ended'],
		['disconnected', 'Stream Ended'],
	] as const)('maps %s to the %s badge label', (status, label) => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain(`Connection state: ${label}`);
	});

	it.each([
		['offline', 'Offline'],
		['interrupted', 'Reconnecting'],
		['stale', 'Reconnecting'],
	] as const)('maps error with reason %s to the %s badge label', (reason, label) => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'error', reason, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain(`Connection state: ${label}`);
	});

	it('hides the badge and shows the username modal trigger while idle', () => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'idle', username: '' }}
				viewerCount={0}
				likeCount={0}
			/>,
		);

		expect(html).toContain('Open Live');
		expect(html).toContain('Open settings');
		expect(html).not.toContain('Connection state:');
	});

	it('groups status details in one left cluster and opens settings from the right icon button', async () => {
		const onOpenSettings = vi.fn();
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<StatusBar
					connectionState={{ status: 'connected', username: 'a-very-long-celestia-host-name' }}
					viewerCount={1200}
					likeCount={45000}
					onOpenSettings={onOpenSettings}
					isSettingsOpen={true}
				/>,
			);
		});

		const cluster = getStatusCluster(container);
		const settingsButton = getSettingsButton(container);

		expect(cluster.textContent).toContain('1,200');
		expect(cluster.textContent).toContain('45,000');
		expect(cluster.textContent).toContain('@a-very-long-celestia-host-name');
		expect(cluster.textContent).toContain('Connected');
		expect(container.firstElementChild?.firstElementChild).toBe(cluster);
		expect(container.firstElementChild?.lastElementChild).toBe(settingsButton);
		expect(settingsButton.getAttribute('aria-pressed')).toBe('true');

		await act(async () => {
			settingsButton.click();
		});

		expect(onOpenSettings).toHaveBeenCalledTimes(1);

		await act(async () => {
			root.unmount();
		});
	});
});

function getStatusCluster(container: Element): HTMLElement {
	const element = container.querySelector('[data-celestia-status-cluster]');

	if (!(element instanceof HTMLElement)) {
		throw new Error('Expected StatusBar to render the left status cluster.');
	}

	return element;
}

function getSettingsButton(container: Element): HTMLButtonElement {
	const element = container.querySelector('[data-celestia-status-settings]');

	if (!(element instanceof HTMLButtonElement)) {
		throw new Error('Expected StatusBar to render the settings button.');
	}

	return element;
}
