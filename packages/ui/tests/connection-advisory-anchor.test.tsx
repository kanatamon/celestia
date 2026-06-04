import type { ConnectionState } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBar } from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

// This suite renders against the REAL AntD Dropdown (no mock), because the bug
// it guards lives entirely in how AntD anchors and toggles the popover via the
// trigger child. The mocked-Dropdown suite (connection-advisory-popover.test.tsx)
// cannot see it.

class TestResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}
if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
}

function faultState(): ConnectionState {
	return { status: 'error', reason: 'interrupted', username: 'celestia' } as ConnectionState;
}

function getAdvisory(): HTMLElement | null {
	return document.querySelector('[data-celestia-connection-advisory]');
}

function getClusterTrigger(container: Element): HTMLElement {
	const trigger = container.querySelector<HTMLElement>(
		'[data-celestia-connection-cluster-trigger]',
	);
	if (!trigger) throw new Error('connection cluster trigger not found');
	return trigger;
}

describe('ConnectionAdvisory anchoring (real AntD Dropdown)', () => {
	const roots: Array<ReturnType<typeof createStrictRoot>> = [];

	function mountFault() {
		const strict = createStrictRoot();
		document.body.append(strict.container);
		roots.push(strict);
		strict.render(
			<StatusBar
				connectionState={faultState()}
				likeCount={2}
				username="celestia"
				viewerCount={1}
			/>,
		);
		return strict;
	}

	afterEach(() => {
		for (const root of roots.splice(0)) {
			root.unmount();
			root.container.remove();
		}
		for (const node of document.querySelectorAll('[data-celestia-connection-advisory]')) {
			node.closest('.ant-dropdown')?.remove();
		}
	});

	it('wires the whole signal+name cluster as the advisory trigger', async () => {
		const strict = mountFault();
		const trigger = getClusterTrigger(strict.container);

		// The trigger spans the cluster (a button wrapping the bars AND the name),
		// not just the tiny bars.
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger.querySelector('[aria-label^="Connection state"]')).not.toBeNull();
		expect(trigger.textContent).toContain('@celestia');

		// The fault auto-opened the advisory under a real `.ant-dropdown`.
		expect(getAdvisory()).not.toBeNull();
		const dropdown = document.querySelector('.ant-dropdown');
		expect(dropdown).not.toBeNull();

		// Clicking the open trigger must control the popover: AntD drives it toward
		// closed (the leave/closing animation begins). This is only possible if the
		// trigger received AntD's injected `onClick` and `ref`. The original bug —
		// `ConnectionSignal` dropping every injected prop on its root `<span>` —
		// left the trigger unwired: AntD had no anchor (so the popover flashed at
		// the top-left corner) and the cluster could neither dismiss nor reopen it.
		//
		// We assert the *closing transition* rather than DOM removal because jsdom
		// fires no `animationend`, so AntD's `destroyOnHidden` leave animation never
		// completes and the node lingers — a jsdom artifact, not the bug.
		await act(async () => {
			trigger.click();
		});
		expect(dropdown?.className).toMatch(/-leave\b/);
	});
});
