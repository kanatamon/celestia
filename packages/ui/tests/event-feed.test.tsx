import type { ChatLiveEvent, GiftLiveEvent } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ChatEventCard,
	EventFeed,
	FeedEventCard,
	GiftEventCard,
	IndividualChatFeed,
	markJustFollowed,
	resetFollowerPulseRegistry,
	ScrollableFeedList,
	SplitFeedLayout,
} from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

globalThis.ResizeObserver ??= class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// JSDOM doesn't implement HTMLElement.scrollTo — polyfill so scrollToBottom works.
if (!HTMLElement.prototype.scrollTo) {
	HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number) {
		if (typeof options === 'object' && options?.top !== undefined) {
			this.scrollTop = options.top;
		}
	};
}

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
					giftEvent('doughnut-1', 15, 'Doughnut', 30, 1, undefined, {
						groupId: 'doughnut-group-1',
						repeatEnd: undefined,
					}),
					giftEvent('doughnut-2', 16, 'Doughnut', 30, 1, undefined, {
						groupId: 'doughnut-group-1',
					}),
					giftEvent('hand-heart-1', 17, 'Hand Heart', 100, 1, undefined, {
						groupId: 'hand-heart-group-1',
						repeatEnd: undefined,
					}),
				]}
				visibleGiftChipCount={4}
			/>,
		);

		expect(html).toContain('Heart Me badge');
		expect(html).toContain('Lion');
		expect(html).toContain('Galaxy');
		expect(html).toContain('Hand Heart');
		expect(html).toContain('Doughnut');
		expect(html).not.toContain('Rose<!-- -->');
		expect(html).toContain('+1 more');
		expect(html).not.toContain('role="tooltip"');
		expect(html).not.toContain('diamonds');
		expect(html).toContain('<svg');
		expect(html).not.toContain('bubblePointer');
	});

	it('counts grouped gift streaks once when repeatEnd is missing from earlier messages', () => {
		const doughnutGroups = Array.from({ length: 7 }, (_, index) => `doughnut-group-${index + 1}`);
		const doughnutEvents = doughnutGroups.flatMap((groupId, index) => [
			giftEvent(`doughnut-start-${index + 1}`, 10 + index * 2, 'Doughnut', 30, 1, undefined, {
				groupId,
				repeatEnd: undefined,
			}),
			giftEvent(`doughnut-end-${index + 1}`, 11 + index * 2, 'Doughnut', 30, 1, undefined, {
				groupId,
			}),
		]);

		const html = renderToString(
			<ChatEventCard
				event={chatEvent('chat-1', 40)}
				userGiftEvents={[
					...doughnutEvents,
					giftEvent('hand-heart-1', 30, 'Hand Heart', 100, 1, undefined, {
						groupId: 'hand-heart-group-1',
						repeatEnd: undefined,
					}),
				]}
				visibleGiftChipCount={10}
			/>,
		);

		expect(html).toContain('Doughnut');
		expect(html).toContain('Hand Heart');
		expect(html).toMatch(
			/alt="Doughnut"\/><span class="[^"]+">x<\/span><span class="[^"]+">7<\/span>/,
		);
		expect(html).toMatch(
			/alt="Hand Heart"\/><span class="[^"]+">x<\/span><span class="[^"]+">1<\/span>/,
		);
	});
});

describe('Follower Badge', () => {
	it('renders the badge when the viewer follows (followStatus 1)', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 1)} />);

		expect(html).toContain('Follows the streamer');
	});

	it('treats mutual follow (followStatus 2) identically to following', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 2)} />);

		// One badge, no friend-tier markup.
		expect(html.match(/role="img" aria-label="Follows the streamer"/g)).toHaveLength(1);
		expect(html).not.toContain('friend');
	});

	it('renders no badge DOM node for a stranger (followStatus 0)', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 0)} />);

		expect(html).not.toContain('Follows the streamer');
	});

	it('renders no badge DOM node when followStatus is undefined', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi')} />);

		expect(html).not.toContain('Follows the streamer');
	});

	it('renders the badge on a 30px gift avatar', () => {
		const html = renderToString(<GiftEventCard event={giftEvent('gift-1', 20, 'Rose', 1, 2, 1)} />);

		expect(html).toContain('Follows the streamer');
	});
});

describe('Top-left badge slot (Heart Me supersedes Follower, ADR-0011)', () => {
	it('shows only the Heart Me badge when a Heart Me gift is present - Follower Badge is suppressed', () => {
		const html = renderToString(
			<ChatEventCard
				event={chatEvent('chat-1', 40, 'hi', 1)}
				userGiftEvents={[giftEvent('heart-1', 10, 'Heart Me', 1, 1)]}
			/>,
		);

		expect(html).toContain('Heart Me badge');
		expect(html).not.toContain('Follows the streamer');
	});

	it('shows the Follower Badge for a plain follower with no Heart Me gift', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 1)} />);

		expect(html).toContain('Follows the streamer');
		expect(html).not.toContain('Heart Me badge');
	});

	it('renders no badge DOM node for a non-follower with no Heart Me gift', () => {
		const html = renderToString(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 0)} />);

		expect(html).not.toContain('Follows the streamer');
		expect(html).not.toContain('Heart Me badge');
	});

	it('shows the Heart Me badge even when followStatus is absent - a Heart Me gift alone suffices', () => {
		const html = renderToString(
			<ChatEventCard
				event={chatEvent('chat-1', 40, 'hi')}
				userGiftEvents={[giftEvent('heart-1', 10, 'Heart Me', 1, 1)]}
			/>,
		);

		expect(html).toContain('Heart Me badge');
		expect(html).not.toContain('Follows the streamer');
	});
});

describe('Follower Badge "just followed" one-shot (#91)', () => {
	afterEach(() => {
		resetFollowerPulseRegistry();
		vi.useRealTimers();
	});

	it("plays once on this viewer's follow transition, settles, and ignores other viewers", () => {
		vi.useFakeTimers();
		const { container, render, unmount } = createStrictRoot();
		// chatEvent's user is `user-1`, already following (followStatus 1) so the
		// static badge is present and can carry the one-shot.
		render(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 1)} />);

		const badge = () => container.querySelector('[aria-label="Follows the streamer"]');
		const badgeClassName = () => badge()?.className ?? '';

		expect(badge()).not.toBeNull();
		expect(badgeClassName()).not.toContain('justFollowed');

		// A follow transition for a DIFFERENT viewer must not pop this badge.
		act(() => {
			markJustFollowed({ userId: 'someone-else' });
		});
		expect(badgeClassName()).not.toContain('justFollowed');

		// This viewer's follow transition arms the one-shot.
		act(() => {
			markJustFollowed({ userId: 'user-1' });
		});
		expect(badgeClassName()).toContain('justFollowed');

		// After the pulse window the pop settles, but the badge persists.
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(badge()).not.toBeNull();
		expect(badgeClassName()).not.toContain('justFollowed');

		unmount();
	});

	it("pops on a viewer's existing card with stale followStatus - no new message needed", () => {
		vi.useFakeTimers();
		const { container, render, unmount } = createStrictRoot();
		// An existing card captured before the follow: stranger standing (0), so no
		// badge is rendered yet.
		render(<ChatEventCard event={chatEvent('chat-1', 40, 'hi', 0)} />);

		const badge = () => container.querySelector('[aria-label="Follows the streamer"]');
		expect(badge()).toBeNull();

		// The follow transition elevates this viewer's standing: the badge appears
		// on the already-rendered card and plays the one-shot - instantly, without
		// requiring the viewer to send a new message.
		act(() => {
			markJustFollowed({ userId: 'user-1' });
		});
		expect(badge()).not.toBeNull();
		expect(badge()?.className ?? '').toContain('justFollowed');

		// The badge stays after the pop (a decoded follow is sticky standing).
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(badge()).not.toBeNull();
		expect(badge()?.className ?? '').not.toContain('justFollowed');

		unmount();
	});

	it('does not fire the pop when the Heart Me badge occupies the slot', () => {
		vi.useFakeTimers();
		const { container, render, unmount } = createStrictRoot();
		// A Heart Me gift claims the top-left slot, so the Follower Badge (and its
		// one-shot) never mounts.
		render(
			<ChatEventCard
				event={chatEvent('chat-1', 40, 'hi', 1)}
				userGiftEvents={[giftEvent('heart-1', 10, 'Heart Me', 1, 1)]}
			/>,
		);

		expect(container.querySelector('[aria-label="Follows the streamer"]')).toBeNull();

		// A follow transition for this viewer cannot pop a badge that isn't there.
		act(() => {
			markJustFollowed({ userId: 'user-1' });
		});
		expect(container.querySelector('.justFollowed')).toBeNull();
		expect(container.innerHTML).toContain('Heart Me badge');

		unmount();
	});
});

describe('GiftEventCard', () => {
	it('renders as a compact one-line gift sentence with the timestamp pinned last', () => {
		vi.useFakeTimers();
		vi.setSystemTime(30_000);
		const { container, render, unmount } = createStrictRoot();

		render(<GiftEventCard event={giftEvent('gift-1', 20, 'Rose', 1, 2)} />);

		const avatar = getImageByAlt(container, '');
		const giftImage = getImageByAlt(container, 'Rose');
		const timestamp = getTimestamp(container);

		expect(avatar.compareDocumentPosition(giftImage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(timestamp.parentElement?.lastElementChild).toBe(timestamp);
		expect(container.textContent).toContain('Viewer sent a Rose');
		expect(container.textContent).toContain('\u00d72');
		expect(container.textContent).toContain('29s');

		unmount();
		vi.useRealTimers();
	});

	it('wraps positive-value gift images with an AntD tooltip trigger only', () => {
		const { container, render, unmount } = createStrictRoot();

		render(<GiftEventCard event={giftEvent('gift-1', 20, 'Galaxy', 1_200, 3)} />);

		const giftImage = getImageByAlt(container, 'Galaxy');
		const tooltipTrigger = giftImage.parentElement;

		expect(tooltipTrigger).not.toBeNull();
		expect(tooltipTrigger).not.toBe(giftImage.closest('span[class*="giftItem"]'));
		expect(giftImage.nextElementSibling).toBeNull();
		expect(container.querySelector('[role="tooltip"]')).toBeNull();

		render(<GiftEventCard event={giftEvent('gift-2', 20, 'Rose', 0, 3)} />);

		const unwrappedGiftImage = getImageByAlt(container, 'Rose');

		expect(unwrappedGiftImage.parentElement).toBe(
			unwrappedGiftImage.closest('span[class*="giftItem"]'),
		);
		expect(unwrappedGiftImage.nextElementSibling).toBeNull();

		unmount();
	});
});

describe('FeedEventCard', () => {
	it('renders a message bubble and nickname for a chat event', () => {
		const html = renderToString(
			<FeedEventCard
				event={chatEvent('chat-1', 10, 'hello world')}
				userGiftEventsByUser={new Map()}
			/>,
		);

		expect(html).toContain('hello world');
		expect(html).toContain('Viewer');
		expect(html).toContain('<svg');
	});

	it('renders a gift sentence and repeat count for a gift event', () => {
		const { container, render, unmount } = createStrictRoot();

		render(
			<FeedEventCard
				event={giftEvent('gift-1', 10, 'Rose', 1, 5)}
				userGiftEventsByUser={new Map()}
			/>,
		);

		expect(container.textContent).toContain('Rose');
		expect(container.textContent).toContain('×5');
		expect(container.querySelector('svg')).toBeNull();

		unmount();
	});
});

describe('EventFeed', () => {
	it('interleaves chat and gift events by timestamp and counts unread events while scrolled up', async () => {
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'first');
		const gift = giftEvent('gift-1', 20, 'Rose', 1, 2);
		const latestChat = chatEvent('chat-2', 30, 'latest');

		render(<EventFeed chatEvents={[latestChat, firstChat]} giftEvents={[gift]} />);

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

		expect(container.textContent).not.toContain('new messages');

		render(
			<EventFeed
				chatEvents={[latestChat, firstChat, chatEvent('chat-3', 40, 'newest')]}
				giftEvents={[gift, giftEvent('gift-2', 50, 'Galaxy', 1, 1)]}
			/>,
		);

		const newMessagesBar = getNewMessagesBar(container);
		expect(newMessagesBar.getAttribute('aria-label')).toBe('2 new messages, scroll down');
		expect(newMessagesBar.textContent).toContain('new messages');
		expect(newMessagesBar.textContent).toContain('scroll down ↓');
		expect(newMessagesBar.textContent).toContain('Viewer');
		expect(newMessagesBar.textContent).toContain('sent Galaxy');
		expect(newMessagesBar.className).toContain('newMessagesBar');

		await act(async () => {
			newMessagesBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(container.textContent).not.toContain('new messages');
		expect(feed.scrollTop).toBe(1000);

		unmount();
	});

	it('uses scrollTo with instant behavior so smooth-scroll CSS cannot cause mid-animation scroll events to flip isAtBottom', async () => {
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'first');

		render(<EventFeed chatEvents={[firstChat]} giftEvents={[]} />);

		const feed = getEventFeed(container);
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1000 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 700 },
		});

		const scrollToCalls: ScrollToOptions[] = [];
		feed.scrollTo = ((options?: ScrollToOptions) => {
			if (options) scrollToCalls.push(options);
		}) as typeof feed.scrollTo;

		render(<EventFeed chatEvents={[firstChat, chatEvent('chat-2', 40, 'new')]} giftEvents={[]} />);

		expect(scrollToCalls).toContainEqual(expect.objectContaining({ behavior: 'instant' }));

		unmount();
	});

	it('uses a 100px bottom threshold and resets unread count when manual scrolling re-engages auto-scroll', async () => {
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'first');

		render(<EventFeed chatEvents={[firstChat]} giftEvents={[]} />);

		const feed = getEventFeed(container);
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1000 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 610 },
		});

		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		render(
			<EventFeed
				chatEvents={[firstChat, chatEvent('chat-2', 40, 'within threshold')]}
				giftEvents={[]}
			/>,
		);

		expect(container.textContent).not.toContain('new messages');
		expect(feed.scrollTop).toBe(1000);

		feed.scrollTop = 590;
		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		render(
			<EventFeed
				chatEvents={[
					firstChat,
					chatEvent('chat-2', 40, 'within threshold'),
					chatEvent('chat-3', 50, 'past threshold'),
				]}
				giftEvents={[]}
			/>,
		);

		const newMessagesBar = getNewMessagesBar(container);
		expect(newMessagesBar.getAttribute('aria-label')).toBe('1 new messages, scroll down');
		expect(newMessagesBar.textContent).toContain('new messages');

		feed.scrollTop = 900;
		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		expect(container.textContent).not.toContain('new messages');

		unmount();
	});

	it('auto-scrolls when events arrive in a high-frequency burst that grows the DOM before the effect reads scroll position', async () => {
		// Regression for: useEffect([events]) fires after the DOM is already committed with
		// new rows, so a live isScrolledToBottom measurement sees the inflated scrollHeight
		// and falsely reports "not at bottom", causing the unread bar to surface even when
		// the user was at the bottom.
		//
		// The fix reads isAtBottomRef (set by the scroll handler, pre-render) instead of
		// re-measuring the DOM inside the effect.
		//
		// To reproduce: prime the ref via a scroll event, then update scrollHeight to
		// simulate the DOM having already grown before the effect runs.
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'first');

		render(<EventFeed chatEvents={[firstChat]} giftEvents={[]} />);

		const feed = getEventFeed(container);
		// User is exactly at bottom: scrollHeight(400) - scrollTop(100) - clientHeight(300) = 0
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 400 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 100 },
		});

		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		// Simulate DOM already grown by 130px (two new events rendered) before the effect
		// fires. With a live measurement: 530 - 100 - 300 = 130 > SCROLL_BOTTOM_THRESHOLD(100)
		// — the old code would have shown the unread bar here.
		Object.defineProperty(feed, 'scrollHeight', { configurable: true, value: 530 });

		render(
			<EventFeed
				chatEvents={[
					firstChat,
					chatEvent('chat-2', 20, 'burst-1'),
					chatEvent('chat-3', 30, 'burst-2'),
				]}
				giftEvents={[]}
			/>,
		);

		expect(container.textContent).not.toContain('new messages');
		expect(feed.scrollTop).toBe(530);

		unmount();
	});

	it('pins one event at a time and toggles between inline, top sticky, and bottom sticky states', async () => {
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'first');
		const gift = giftEvent('gift-1', 20, 'Rose', 1, 2);
		const latestChat = chatEvent('chat-2', 30, 'latest');

		render(<EventFeed chatEvents={[firstChat, latestChat]} giftEvents={[gift]} />);

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

		unmount();
	});
});

describe('ScrollableFeedList', () => {
	it('renders the aurora overlay when the feed starts at the bottom', async () => {
		const { container, render, unmount } = createStrictRoot();
		const events = [chatEvent('chat-1', 10, 'first')];

		render(
			<ScrollableFeedList events={events}>
				<div>content</div>
			</ScrollableFeedList>,
		);

		expect(container.querySelector('[data-celestia-aurora]')).toBeInstanceOf(HTMLElement);

		unmount();
	});

	it('hides the aurora overlay as soon as the user scrolls away from the bottom', async () => {
		const { container, render, unmount } = createStrictRoot();
		const events = [chatEvent('chat-1', 10, 'first')];

		render(
			<ScrollableFeedList events={events}>
				<div>content</div>
			</ScrollableFeedList>,
		);

		const feed = container.querySelector('[data-celestia-event-feed]') as HTMLElement;
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1000 },
			clientHeight: { configurable: true, value: 300 },
			scrollTop: { configurable: true, writable: true, value: 100 },
		});

		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		expect(container.querySelector('[data-celestia-aurora]')).toBeNull();

		feed.scrollTop = 1000;
		await act(async () => {
			feed.dispatchEvent(new Event('scroll', { bubbles: true }));
		});

		expect(container.querySelector('[data-celestia-aurora]')).toBeInstanceOf(HTMLElement);

		unmount();
	});

	it('scrolls to the target event on mount when initialScrollTarget is an event ID', async () => {
		// jsdom clamps scrollTop to 0 when there is no real layout (scrollHeight = 0).
		// Replace the Element.prototype scrollTop accessor with a WeakMap-backed one so
		// direct assignment persists for this test, then restore it afterwards.
		const scrollTopValues = new WeakMap<object, number>();
		const originalScrollTopDescriptor =
			Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop') ?? {};
		Object.defineProperty(Element.prototype, 'scrollTop', {
			configurable: true,
			get(this: Element) {
				return scrollTopValues.get(this) ?? 0;
			},
			set(this: Element, value: number) {
				scrollTopValues.set(this, value);
			},
		});

		// Stub getBoundingClientRect so the scroll delta is non-zero.
		// feed top=50, chat-2 top=150 → expected delta = 100.
		const originalGetBCR = HTMLElement.prototype.getBoundingClientRect;
		HTMLElement.prototype.getBoundingClientRect = function () {
			if ((this as HTMLElement).dataset.feedEventId === 'chat-2') {
				return { top: 150 } as DOMRect;
			}
			if ((this as HTMLElement).hasAttribute('data-celestia-event-feed')) {
				return { top: 50 } as DOMRect;
			}
			return originalGetBCR.call(this);
		};

		const { container, render, unmount } = createStrictRoot();
		const events = [
			chatEvent('chat-1', 10, 'first'),
			chatEvent('chat-2', 20, 'second'),
			chatEvent('chat-3', 30, 'third'),
		];

		render(
			<ScrollableFeedList events={events} initialScrollTarget="chat-2">
				{events.map((e) => (
					<div key={e.id} data-feed-event-id={e.id}>
						{e.text}
					</div>
				))}
			</ScrollableFeedList>,
		);

		const feedScrollTop = getFeed(container).scrollTop;
		HTMLElement.prototype.getBoundingClientRect = originalGetBCR;
		Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTopDescriptor);

		expect(feedScrollTop).toBe(100);

		unmount();
	});
});

describe('IndividualChatFeed', () => {
	it('shows the empty state when no viewer is pinned', () => {
		const html = renderToString(
			<IndividualChatFeed chatEvents={[chatEvent('chat-1', 10)]} giftEvents={[]} />,
		);

		expect(html).toContain('Click a message to open a viewer&#x27;s feed');
		expect(html).toContain('Their messages will appear here');
		expect(html).toContain('data-celestia-individual-chat-feed=""');
		expect(html).not.toContain('data-celestia-individual-viewer-pill');
		expect(html).not.toContain('data-individual-event-id="chat-1"');
	});

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
			/>,
		);

		expect(html).toContain('from pinned viewer');
		expect(html).toContain('Rose');
		expect(html).toContain('hello');
		expect(html).not.toContain('not relevant');
		expect(html).toContain('data-individual-event-id="gift-1"');
		expect(html).toContain('pinnedIndividualEventRow');
	});

	it('renders the pinned viewer as a floating avatar-only dismissible pill without redundant headers', async () => {
		const { container, render, unmount } = createStrictRoot();
		const pinnedViewerChat = chatEvent('chat-1', 10, 'from pinned viewer');
		let dismissedEvent: ChatLiveEvent | GiftLiveEvent | undefined = pinnedViewerChat;

		render(
			<IndividualChatFeed
				chatEvents={[pinnedViewerChat]}
				giftEvents={[]}
				pinnedEvent={pinnedViewerChat}
				onPinnedEventChange={(event) => {
					dismissedEvent = event;
				}}
			/>,
		);

		expect(container.querySelector('[data-celestia-individual-feed-header]')).toBeNull();
		expect(container.textContent).not.toContain('Viewer feed');
		const pill = container.querySelector('[data-celestia-individual-viewer-pill]');
		expect(pill).toBeInstanceOf(HTMLElement);
		expect(pill?.textContent).not.toContain('Viewer');
		expect(pill?.getAttribute('aria-label')).toBe('Viewer feed controls');

		const dismissButton = container.querySelector('[data-celestia-viewer-pill-dismiss]');
		expect(dismissButton).toBeInstanceOf(HTMLElement);
		expect(dismissButton?.querySelector('svg')).toBeInstanceOf(SVGElement);

		await act(async () => {
			dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});

		expect(dismissedEvent).toBeUndefined();

		unmount();
	});

	it('does not surface the new-messages bar when an event arrives on a short, non-scrollable feed', async () => {
		// jsdom leaves scrollHeight/clientHeight at 0, so the feed is non-scrollable and
		// fires no scroll event. Because IndividualChatFeed uses an event ID as its
		// initialScrollTarget, a cached "at bottom" flag would stay false and never be
		// corrected — surfacing the bar even though every event is already visible.
		const { container, render, unmount } = createStrictRoot();
		const pinnedViewerChat = chatEvent('chat-1', 10, 'from pinned viewer');

		render(
			<IndividualChatFeed
				chatEvents={[pinnedViewerChat]}
				giftEvents={[]}
				pinnedEvent={pinnedViewerChat}
			/>,
		);

		render(
			<IndividualChatFeed
				chatEvents={[pinnedViewerChat, chatEvent('chat-2', 20, 'just arrived')]}
				giftEvents={[]}
				pinnedEvent={pinnedViewerChat}
			/>,
		);

		expect(container.textContent).not.toContain('new messages');

		unmount();
	});
});

describe('SplitFeedLayout', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the individual feed visible with an empty state until a viewer is pinned', async () => {
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 10, 'from pinned viewer');
		const mention = chatEvent('chat-2', 20, 'hello @Viewer');
		mention.user = {
			userId: 'user-2',
			uniqueId: 'other',
			nickname: 'Other',
		};

		render(<SplitFeedLayout chatEvents={[firstChat, mention]} giftEvents={[]} />);

		const layout = getSplitFeedLayout(container);
		setElementWidth(layout, 720);
		emitResize(layout, 720);

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeInstanceOf(
			HTMLElement,
		);
		expect(container.textContent).toContain("Click a message to open a viewer's feed");
		expect(container.textContent).toContain('Their messages will appear here');
		expect(container.querySelector('[data-celestia-individual-viewer-pill]')).toBeNull();

		await act(async () => {
			getEventRow(container, 'chat-1').dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		});

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeInstanceOf(
			HTMLElement,
		);
		expect(container.querySelector('[data-celestia-split-feed-collapsed]')).toBeNull();
		expect(container.textContent).not.toContain("Click a message to open a viewer's feed");
		expect(container.querySelector('[data-celestia-individual-viewer-pill]')).toBeInstanceOf(
			HTMLElement,
		);

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
			getPillDismiss(container).dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			);
		});

		expect(container.querySelector('[data-celestia-individual-chat-feed]')).toBeInstanceOf(
			HTMLElement,
		);
		expect(container.textContent).toContain("Click a message to open a viewer's feed");
		expect(getEventRow(container, 'chat-1').dataset.pinned).toBeUndefined();

		unmount();
	});

	it('updates timestamp labels over time without a static now prop', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(30_000);
		const { container, render, unmount } = createStrictRoot();
		const firstChat = chatEvent('chat-1', 0, 'aging message');

		render(<SplitFeedLayout chatEvents={[firstChat]} giftEvents={[]} />);

		expect(container.textContent).toContain('30s');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(31_000);
		});

		expect(container.textContent).toContain('1m');

		unmount();
	});
});

function getTextContent(container: Element): string {
	return container.textContent ?? '';
}

function getEventFeed(container: Element): HTMLElement {
	return getFeed(container);
}

function getFeed(container: Element): HTMLElement {
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

function getNewMessagesBar(container: Element): HTMLButtonElement {
	const button = container.querySelector('button[data-celestia-new-messages-bar]');

	if (!(button instanceof HTMLButtonElement)) {
		throw new Error('Expected new messages bar to render.');
	}

	return button;
}

function getPillDismiss(container: Element): HTMLElement {
	const element = container.querySelector('[data-celestia-viewer-pill-dismiss]');

	if (!(element instanceof HTMLElement)) {
		throw new Error('Expected viewer pill dismiss element to render.');
	}

	return element;
}

function chatEvent(
	id: string,
	ts: number,
	text = 'hello @celestia',
	followStatus?: number,
): ChatLiveEvent {
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
			followStatus,
		},
	};
}

function giftEvent(
	id: string,
	ts: number,
	giftName: string,
	diamondCount: number,
	repeatCount: number,
	followStatus?: number,
	overrides: Partial<GiftLiveEvent> = {},
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
		repeatEnd: true,
		...overrides,
		user: {
			userId: 'user-1',
			uniqueId: 'viewer',
			nickname: 'Viewer',
			avatarUrl: 'https://example.test/avatar.png',
			followStatus,
		},
	};
}
