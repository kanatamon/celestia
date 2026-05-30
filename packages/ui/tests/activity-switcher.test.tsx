import type { GiftLiveEvent, MemberLiveEvent } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivitySwitcher } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ActivitySwitcher', () => {
	it('renders the latest join event by default and toggles to the gift parade', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<ActivitySwitcher
					memberEvents={[
						memberEvent('member-1', 10, 'First Viewer'),
						memberEvent('member-2', 20, 'Latest Viewer'),
					]}
					giftEvents={[
						giftEvent('rose-1', 'Rose', 1, 2),
						giftEvent('galaxy-1', 'Galaxy', 1000, 1),
						giftEvent('rose-2', 'Rose', 1, 3),
					]}
				/>,
			);
		});

		expect(container.textContent).toContain('Latest Viewer joined');
		expect(container.textContent).not.toContain('First Viewer joined');

		const switcher = getActivitySwitcher(container);

		expect(switcher.getAttribute('aria-label')).toBe('Show gift parade');
		expect(getActiveDotIndex(container)).toBe(0);

		await act(async () => {
			switcher.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(switcher.getAttribute('aria-label')).toBe('Show join activity');
		expect(getActiveDotIndex(container)).toBe(1);

		const text = container.textContent ?? '';
		expect(text.indexOf('Galaxy')).toBeLessThan(text.indexOf('Rose'));
		expect(text).toContain('x1');
		expect(text).toContain('x5');

		await act(async () => {
			root.unmount();
		});
	});

	it('renders placeholders and updates the ticker signature when counts change', async () => {
		const html = renderToString(<ActivitySwitcher memberEvents={[]} giftEvents={[]} />);

		expect(html).toContain('Waiting for viewers...');

		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(<ActivitySwitcher memberEvents={[]} giftEvents={[]} initialView="gifts" />);
		});

		expect(container.textContent).toContain('No gifts yet...');

		await act(async () => {
			root.render(
				<ActivitySwitcher
					memberEvents={[]}
					giftEvents={[giftEvent('rose-1', 'Rose', 1, 1)]}
					initialView="gifts"
				/>,
			);
		});

		const firstSignature = getTicker(container).dataset.tickerSignature;

		await act(async () => {
			root.render(
				<ActivitySwitcher
					memberEvents={[]}
					giftEvents={[giftEvent('rose-1', 'Rose', 1, 1), giftEvent('rose-2', 'Rose', 1, 4)]}
					initialView="gifts"
				/>,
			);
		});

		expect(getTicker(container).dataset.tickerSignature).not.toBe(firstSignature);
		expect(container.textContent).toContain('x5');

		await act(async () => {
			root.unmount();
		});
	});

	it('pauses the gift parade while hovered and resumes on leave', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<ActivitySwitcher
					memberEvents={[]}
					giftEvents={[giftEvent('rose-1', 'Rose', 1, 1), giftEvent('galaxy-1', 'Galaxy', 1000, 1)]}
					initialView="gifts"
				/>,
			);
		});

		const parade = getParade(container);

		expect(parade.dataset.paradePaused).toBe('false');

		await act(async () => {
			parade.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
		});

		expect(parade.dataset.paradePaused).toBe('true');

		await act(async () => {
			parade.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }));
		});

		expect(parade.dataset.paradePaused).toBe('false');

		await act(async () => {
			root.unmount();
		});
	});
});

function getActivitySwitcher(container: Element): HTMLElement {
	const element = container.querySelector('[data-celestia-activity-switcher]');

	if (!(element instanceof HTMLElement)) {
		throw new Error('Expected ActivitySwitcher to render.');
	}

	return element;
}

function getTicker(container: Element): HTMLElement {
	const element = container.querySelector('[data-celestia-gift-ticker]');

	if (!(element instanceof HTMLElement)) {
		throw new Error('Expected gift ticker to render.');
	}

	return element;
}

function getParade(container: Element): HTMLElement {
	const element = container.querySelector('[data-celestia-gift-parade]');

	if (!(element instanceof HTMLElement)) {
		throw new Error('Expected gift parade to render.');
	}

	return element;
}

function getActiveDotIndex(container: Element): number {
	return [...container.querySelectorAll('[data-activity-dot]')].findIndex(
		(element) => element.getAttribute('data-active') === 'true',
	);
}

function memberEvent(id: string, ts: number, nickname: string): MemberLiveEvent {
	return {
		id,
		ts,
		type: 'member',
		source: 'test',
		user: {
			userId: id,
			uniqueId: nickname.toLowerCase().replaceAll(' ', '-'),
			nickname,
		},
	};
}

function giftEvent(
	id: string,
	giftName: string,
	diamondCount: number,
	repeatCount: number,
): GiftLiveEvent {
	return {
		id,
		ts: Date.now(),
		type: 'gift',
		source: 'test',
		giftName,
		giftImageUrl: `https://example.test/${giftName}.png`,
		diamondCount,
		repeatCount,
	};
}
