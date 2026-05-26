import type { ChatLiveEvent, GiftLiveEvent } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ChatEventCard,
	EventFeed,
	GiftEventCard,
	IndividualChatFeed,
	SplitFeedLayout,
} from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

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
		expect(html).not.toContain('role="tooltip"');
		expect(html).not.toContain('diamonds');
	});
});

describe('GiftEventCard', () => {
	it('renders as a compact one-line gift sentence with the timestamp pinned last', () => {
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<GiftEventCard event={giftEvent('gift-1', 20, 'Rose', 1, 2)} now={30_000} />);
		});

		const avatar = getImageByAlt(container, '');
		const giftImage = getImageByAlt(container, 'Rose');
		const timestamp = getTimestamp(container);

		expect(avatar.compareDocumentPosition(giftImage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(timestamp.parentElement?.lastElementChild).toBe(timestamp);
		expect(container.textContent).toContain('Viewer sent a Rose');
		expect(container.textContent).toContain('\u00d72');
		expect(container.textContent).toContain('29s');

		act(() => {
			root.unmount();
		});
	});

	it('renders the formatted diamond value tooltip only for positive gift image values', () => {
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(
				<GiftEventCard event={giftEvent('gift-1', 20, 'Galaxy', 1_200, 3)} now={30_000} />,
			);
		});

		const giftImage = getImageByAlt(container, 'Galaxy');

		expect(giftImage.nextElementSibling?.getAttribute('role')).toBe('tooltip');
		expect(giftImage.nextElementSibling?.textContent).toBe('3,600 diamonds (1,200 each)');

		act(() => {
			root.render(<GiftEventCard event={giftEvent('gift-2', 20, 'Rose', 0, 3)} now={30_000} />);
		});

		expect(getImageByAlt(container, 'Rose').nextElementSibling).toBeNull();

		act(() => {
			root.unmount();
		});
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
			getButton(container, 'New messages').dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		});

		expect(container.textContent).not.toContain('New messages');

		await act(async () => {
			root.unmount();
		});
	});

	it('pins one event at a time and toggles between inline, top sticky, and bottom sticky states', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);
		const firstChat = chatEvent('chat-1', 10, 'first');
		const gift = giftEvent('gift-1', 20, 'Rose', 1, 2);
		const latestChat = chatEvent('chat-2', 30, 'latest');

		await act(async () => {
			root.render(<EventFeed chatEvents={[firstChat, latestChat]} giftEvents={[gift]} now={30} />);
		});

		const feed = getEventFeed(container);
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1000 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 0 },
		});

		const firstRow = getEventRow(container, 'chat-1');
		const giftRow = getEventRow(container, 'gift-1');
		Object.defineProperties(firstRow, {
			offsetTop: { configurable: true, value: 100 },
			offsetHeight: { configurable: true, value: 60 },
		});
		Object.defineProperties(giftRow, {
			offsetTop: { configurable: true, value: 520 },
			offsetHeight: { configurable: true, value: 80 },
		});

		await act(async () => {
			firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(firstRow.dataset.pinned).toBe('true');
		expect(firstRow.dataset.stickyStage).toBe('inline');

		feed.scrollTop = 200;
		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		expect(firstRow.dataset.stickyStage).toBe('top');

		await act(async () => {
			firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(feed.scrollTop).toBe(100);
		expect(firstRow.dataset.pinned).toBe('true');
		expect(firstRow.dataset.stickyStage).toBe('inline');

		await act(async () => {
			firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(firstRow.dataset.pinned).toBeUndefined();

		feed.scrollTop = 0;
		await act(async () => {
			giftRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(giftRow.dataset.pinned).toBe('true');
		expect(giftRow.dataset.stickyStage).toBe('bottom');
		expect(firstRow.dataset.pinned).toBeUndefined();

		await act(async () => {
			root.unmount();
		});
	});
});

describe('IndividualChatFeed', () => {
	it('shows pinned viewer events and chat mentions, and highlights the triggering event', () => {
		const pinnedViewerChat = chatEvent('chat-1', 10, 'from pinned viewer');
		const pinnedViewerGift = giftEvent('gift-1', 20, 'Rose', 1, 2);
		const mention = chatEvent('chat-2', 30, 'hello @Viewer');
		const unrelated = chatEvent('chat-3', 40, 'not relevant');

		mention.user = {
			userId: 'user-2',
			uniqueId: 'other',
			nickname: 'Other',
		};
		unrelated.user = mention.user;

		const html = renderToString(
			<IndividualChatFeed
				chatEvents={[pinnedViewerChat, mention, unrelated]}
				giftEvents={[pinnedViewerGift]}
				pinnedEvent={pinnedViewerGift}
				now={40}
			/>,
		);

		expect(html).toContain('from pinned viewer');
		expect(html).toContain('Rose');
		expect(html).toContain('hello');
		expect(html).not.toContain('not relevant');
		expect(html).toContain('data-individual-event-id="gift-1"');
		expect(html).toContain('pinnedIndividualEventRow');
	});

	it('renders the pinned viewer as a floating dismissible pill without redundant headers', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);
		const pinnedViewerChat = chatEvent('chat-1', 10, 'from pinned viewer');
		let dismissedEvent: ChatLiveEvent | GiftLiveEvent | undefined = pinnedViewerChat;

		await act(async () => {
			root.render(
				<IndividualChatFeed
					chatEvents={[pinnedViewerChat]}
					giftEvents={[]}
					pinnedEvent={pinnedViewerChat}
					onPinnedEventChange={(event) => {
						dismissedEvent = event;
					}}
					now={40}
				/>,
			);
		});

		expect(container.querySelector('[data-celestia-individual-feed-header]')).toBeNull();
		expect(container.textContent).not.toContain('Viewer feed');
		const pill = container.querySelector('[data-celestia-individual-viewer-pill]');
		expect(pill).toBeInstanceOf(HTMLElement);
		expect(pill?.textContent).toContain('Viewer');

		const dismissButton = container.querySelector('[aria-label="Dismiss pinned viewer"]');
		expect(dismissButton).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(dismissedEvent).toBeUndefined();

		await act(async () => {
			root.unmount();
		});
	});
});

describe('SplitFeedLayout', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('opens the individual feed when an event is pinned, collapses by min pane width, and restores it', async () => {
		const container = document.createElement('div');
		const root = createRoot(container);
		const firstChat = chatEvent('chat-1', 10, 'from pinned viewer');
		const mention = chatEvent('chat-2', 20, 'hello @Viewer');
		mention.user = {
			userId: 'user-2',
			uniqueId: 'other',
			nickname: 'Other',
		};

		await act(async () => {
			root.render(<SplitFeedLayout chatEvents={[firstChat, mention]} giftEvents={[]} now={30} />);
		});

		const layout = getSplitFeedLayout(container);
		setElementWidth(layout, 720);
		emitResize(layout, 720);

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeNull();

		await act(async () => {
			getEventRow(container, 'chat-1').dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		});

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeInstanceOf(
			HTMLElement,
		);
		expect(container.querySelector('[data-celestia-split-feed-collapsed]')).toBeNull();

		emitResize(layout, 480);

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeNull();
		expect(container.querySelector('[data-celestia-split-feed-collapsed]')).toBeInstanceOf(
			HTMLElement,
		);
		expect(getEventRow(container, 'chat-1').dataset.pinned).toBe('true');

		emitResize(layout, 720);

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeInstanceOf(
			HTMLElement,
		);

		await act(async () => {
			getEventRow(container, 'chat-1').dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		});

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeNull();

		await act(async () => {
			root.unmount();
		});
	});

	it('updates timestamp labels over time without a static now prop', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(30_000);
		const container = document.createElement('div');
		const root = createRoot(container);
		const firstChat = chatEvent('chat-1', 0, 'aging message');

		await act(async () => {
			root.render(<SplitFeedLayout chatEvents={[firstChat]} giftEvents={[]} />);
		});

		expect(container.textContent).toContain('30s');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(31_000);
		});

		expect(container.textContent).toContain('1m');

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

function getEventRow(container: Element, eventId: string): HTMLElement {
	const row = container.querySelector(`[data-event-id="${eventId}"]`);

	if (!(row instanceof HTMLElement)) {
		throw new Error(`Expected event row ${eventId} to render.`);
	}

	return row;
}

function getSplitFeedLayout(container: Element): HTMLElement {
	const layout = container.querySelector('[data-celestia-split-feed-layout]');

	if (!(layout instanceof HTMLElement)) {
		throw new Error('Expected split feed layout to render.');
	}

	return layout;
}

function getImageByAlt(container: Element, alt: string): HTMLImageElement {
	const image = container.querySelector(`img[alt="${alt}"]`);

	if (!(image instanceof HTMLImageElement)) {
		throw new Error(`Expected image with alt text "${alt}" to render.`);
	}

	return image;
}

function getTimestamp(container: Element): HTMLTimeElement {
	const timestamp = container.querySelector('time');

	if (!(timestamp instanceof HTMLTimeElement)) {
		throw new Error('Expected timestamp to render.');
	}

	return timestamp;
}

function setElementWidth(element: HTMLElement, width: number): void {
	Object.defineProperty(element, 'clientWidth', { configurable: true, value: width });
}

function emitResize(element: HTMLElement, width: number): void {
	setElementWidth(element, width);
	act(() => {
		window.dispatchEvent(new Event('resize'));
	});
}

function getButton(container: Element, text: string): HTMLButtonElement {
	const button = [...container.querySelectorAll('button')].find(
		(element) => element.textContent === text,
	);

	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Expected ${text} button to render.`);
	}

	return button;
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
