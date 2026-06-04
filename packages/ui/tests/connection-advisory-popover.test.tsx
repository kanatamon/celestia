import type { ConnectionState } from '@celestia/tiktok-live-core';
import type { ReactElement, ReactNode } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// Replace AntD overlay primitives with inline stand-ins so jsdom renders the
// advisory content inline when open — the advisory only uses Dropdown for
// positioning/portal/trigger, mirroring the SettingsPopover test convention.
vi.mock('antd', async (importOriginal) => {
	const actual = await importOriginal<typeof import('antd')>();
	const React = await import('react');

	function Dropdown({
		children,
		open,
		onOpenChange,
		popupRender,
	}: {
		children: ReactElement<{ onClick?: () => void }>;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		popupRender?: (originNode: ReactNode) => ReactNode;
	}) {
		const child = React.cloneElement(children, {
			onClick: () => onOpenChange?.(!open),
		});

		return React.createElement('div', null, child, open ? popupRender?.(null) : null);
	}

	return { ...actual, Dropdown };
});

function renderStatusBar(connectionState: ConnectionState, onReconnect?: () => void) {
	const { container, render, unmount } = createStrictRoot();
	render(
		<StatusBar
			connectionState={connectionState}
			likeCount={2}
			onReconnect={onReconnect}
			username="celestia"
			viewerCount={1}
		/>,
	);
	return { container, render, unmount };
}

function getAdvisory(container: Element): HTMLElement | null {
	return container.querySelector('[data-celestia-connection-advisory]');
}

describe('ConnectionAdvisory (via StatusBar)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('auto-opens with the offline copy and no action button', () => {
		const { container, unmount } = renderStatusBar({
			status: 'error',
			reason: 'offline',
			username: 'celestia',
		});

		const advisory = getAdvisory(container);
		expect(advisory).not.toBeNull();
		expect(advisory?.getAttribute('data-accent')).toBe('red');
		expect(advisory?.textContent).toMatch(/offline/i);
		expect(container.querySelector('button[aria-label="Reconnect"]')).toBeNull();

		unmount();
	});

	it.each([
		'interrupted',
		'stale',
	] as const)('auto-opens with the %s copy and a Reconnect button', (reason) => {
		const { container, unmount } = renderStatusBar({
			status: 'error',
			reason,
			username: 'celestia',
		});

		const advisory = getAdvisory(container);
		expect(advisory).not.toBeNull();
		expect(advisory?.getAttribute('data-accent')).toBe('amber');
		expect(container.querySelector('button[aria-label="Reconnect"]')).toBeInstanceOf(
			HTMLButtonElement,
		);

		unmount();
	});

	it('does not auto-open for a healthy connection', () => {
		const { container, unmount } = renderStatusBar({ status: 'connected', username: 'celestia' });
		expect(getAdvisory(container)).toBeNull();
		unmount();
	});

	it('shows no advisory for a normal stream end', () => {
		const { container, unmount } = renderStatusBar({
			status: 'disconnected',
			username: 'celestia',
		});
		expect(getAdvisory(container)).toBeNull();
		unmount();
	});

	it('fires onReconnect when the Reconnect button is clicked', async () => {
		const onReconnect = vi.fn();
		const { container, unmount } = renderStatusBar(
			{ status: 'error', reason: 'interrupted', username: 'celestia' },
			onReconnect,
		);

		const button = container.querySelector('button[aria-label="Reconnect"]');
		expect(button).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			(button as HTMLButtonElement).click();
		});

		expect(onReconnect).toHaveBeenCalledTimes(1);

		unmount();
	});

	it('auto-closes when the connection recovers', async () => {
		const { container, render, unmount } = renderStatusBar({
			status: 'error',
			reason: 'interrupted',
			username: 'celestia',
		});

		expect(getAdvisory(container)).not.toBeNull();

		await act(async () => {
			render(
				<StatusBar
					connectionState={{ status: 'connected', username: 'celestia' }}
					likeCount={2}
					username="celestia"
					viewerCount={1}
				/>,
			);
		});

		expect(getAdvisory(container)).toBeNull();

		unmount();
	});
});
