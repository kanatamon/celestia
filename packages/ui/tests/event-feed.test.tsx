import type { ChatLiveEvent, GiftLiveEvent } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatEventCard, EventFeed } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChatEventCard', () => {
	it('aggregates gift chips by value, excludes Heart Me, and shows the overflow count', () => {
		const html = renderToString(
			<ChatEventCard
				event={chatEvent('chat-1', 40)}
				userGiftEvents={[
					giftEvent('heart-1', 10, 'Heart Me', 1, 1),
					giftEvent('rose-1', 11, 'Rose', 1, 2),
					giftEvent('galaxy-1', 12, 'Galaxy', 1000, 1),
					giftEvent('rose-2', 13, 'Rose', 1, 3),
					giftEvent('lion-1', 14, 'Lion', 29999, 1),
				]}
				visibleGiftChipCount={2}
				now={40}
			/>,
		);

		expect(html).toContain('Heart Me badge');
		expect(html).toContain('Lion');
		expect(html).toContain('Galaxy');
		expect(html).not.toContain('Rose<!-- -->');
		expect(html).toContain('+1 more');
	});
});

describe('EventFeed', () => {
	it('interleaves chat and gift events by timestamp and reveals new messages when scrolled up', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);
		const firstChat = chatEvent('chat-1', 10, 'first');
		const gift = giftEvent('gift-1', 20, 'Rose', 1, 2);
		const latestChat = chatEvent('chat-2', 30, 'latest');

		await act(async () => {
			root.render(<EventFeed chatEvents={[latestChat, firstChat]} giftEvents={[gift]} now={30} />);
		});

		const text = getTextContent(container);

		expect(text.indexOf('first')).toBeLessThan(text.indexOf('Rose'));
		expect(text.indexOf('Rose')).toBeLessThan(text.indexOf('latest'));

		const feed = getEventFeed(container);
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1000 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 100 },
		});

		await act(async () => {
			feed?.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		expect(container.textContent).toContain('New messages');

		await act(async () => {
			root.render(
				<EventFeed
					chatEvents={[latestChat, firstChat, chatEvent('chat-3', 40, 'newest')]}
					giftEvents={[gift]}
					now={40}
				/>,
			);
		});

		expect(container.textContent).toContain('New messages');

		await act(async () => {
			container
				.querySelector('button')
				?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(container.textContent).not.toContain('New messages');

		await act(async () => {
			root.unmount();
		});
	});
});

function getTextContent(container: Element): string {
	return container.textContent ?? '';
}

function getEventFeed(container: Element): HTMLElement {
	const feed = container.querySelector('[data-celestia-event-feed]');

	if (!(feed instanceof HTMLElement)) {
		throw new Error('Expected event feed element to render.');
	}

	return feed;
}

function chatEvent(id: string, ts: number, text = 'hello @celestia'): ChatLiveEvent {
	return {
		id,
		ts,
		type: 'chat',
		source: 'test',
		text,
		user: {
			userId: 'user-1',
			uniqueId: 'viewer',
			nickname: 'Viewer',
			avatarUrl: 'https://example.test/avatar.png',
		},
	};
}

function giftEvent(
	id: string,
	ts: number,
	giftName: string,
	diamondCount: number,
	repeatCount: number,
): GiftLiveEvent {
	return {
		id,
		ts,
		type: 'gift',
		source: 'test',
		giftName,
		giftImageUrl: `https://example.test/${giftName}.png`,
		diamondCount,
		repeatCount,
		user: {
			userId: 'user-1',
			uniqueId: 'viewer',
			nickname: 'Viewer',
			avatarUrl: 'https://example.test/avatar.png',
		},
	};
}
