import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StatusBar } from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

class TestResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = TestResizeObserver;
}

describe('StatusBar', () => {
	it('renders formatted counts, username, and connection signal', () => {
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
	] as const)('maps %s to the %s connection signal label', (status, label) => {
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
		['connecting', 'discovering'],
		['connected', 'connected'],
		['error', 'reconnecting'],
		['detached', 'ended'],
	] as const)('marks %s username styling with the %s state bucket', (status, state) => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain(`data-state="${state}"`);
	});

	it.each([
		['connecting', 'discovering'],
		['connected', 'connected'],
		['error', 'reconnecting'],
		['detached', 'ended'],
	] as const)('marks the username gradient scope with the %s state so its colour tracks the signal', (status, state) => {
		const { container, render, unmount } = createStrictRoot();

		render(
			<StatusBar
				connectionState={{ status, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		const signal = container.querySelector('[role="status"][data-state]');
		const gradientScope = signal?.parentElement;
		const username = gradientScope?.lastElementChild;

		expect(gradientScope?.getAttribute('data-state')).toBe(state);
		expect(username?.textContent).toBe('@celestia');

		unmount();
	});

	it('marks offline errors with the offline username styling bucket', () => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'error', reason: 'offline', username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain('data-state="offline"');
	});

	it.each([
		['offline', 'Offline'],
		['interrupted', 'Reconnecting'],
		['stale', 'Reconnecting'],
	] as const)('maps error with reason %s to the %s connection signal label', (reason, label) => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'error', reason, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain(`Connection state: ${label}`);
	});

	it('hides the connection signal and shows the username modal trigger while idle', () => {
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

	it('renders the identity first with bare signal bars and no visible signal label', () => {
		const { container, render, unmount } = createStrictRoot();

		render(
			<StatusBar
				connectionState={{ status: 'connected', username: 'celestia' }}
				viewerCount={1200}
				likeCount={45000}
			/>,
		);

		const cluster = getStatusCluster(container);
		const children = Array.from(cluster.children);
		const connectionSignal = getConnectionSignal(container, 'Connected');
		const [identityElement, viewerMetric, likeMetric] = children;
		const [signalElement, usernameElement] = Array.from(identityElement?.children ?? []);

		expect(children).toHaveLength(3);
		expect(identityElement?.tagName).toBe('SPAN');
		expect(signalElement).toBe(connectionSignal);
		expect(usernameElement?.textContent).toBe('@celestia');
		expect(viewerMetric?.textContent).toBe('1,200');
		expect(likeMetric?.textContent).toBe('45,000');
		expect(cluster.textContent).not.toContain('Connected');
		expect(connectionSignal.textContent).toBe('');

		unmount();
	});

	it('groups status details in one left cluster and opens settings from the right icon button', async () => {
		const onOpenSettings = vi.fn();
		const { container, render, unmount } = createStrictRoot();

		render(
			<StatusBar
				connectionState={{ status: 'connected', username: 'a-very-long-celestia-host-name' }}
				viewerCount={1200}
				likeCount={45000}
				onOpenSettings={onOpenSettings}
				isSettingsOpen={true}
			/>,
		);

		const cluster = getStatusCluster(container);
		const settingsButton = getSettingsButton(container);

		expect(cluster.textContent).toContain('1,200');
		expect(cluster.textContent).toContain('45,000');
		expect(cluster.textContent).toContain('@a-very-long-celestia-host-name');
		expect(getConnectionSignal(container, 'Connected')).toBeInstanceOf(HTMLElement);
		expect(container.firstElementChild?.firstElementChild).toBe(cluster);
		expect(container.firstElementChild?.lastElementChild).toBe(settingsButton);
		expect(settingsButton.getAttribute('aria-pressed')).toBe('true');

		await act(async () => {
			settingsButton.click();
		});

		expect(onOpenSettings).toHaveBeenCalledTimes(1);

		unmount();
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

function getConnectionSignal(container: Element, label: string): HTMLElement {
	const element = container.querySelector(`[aria-label="Connection state: ${label}"]`);

	if (!(element instanceof HTMLElement)) {
		throw new Error(`Expected StatusBar to render the ${label} connection signal.`);
	}

	return element;
}
