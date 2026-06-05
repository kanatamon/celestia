import { CloseOutlined } from '@ant-design/icons';
import type { ChatLiveEvent, EmoteInfo, GiftLiveEvent, UserInfo } from '@celestia/tiktok-live-core';
import { Splitter, Tag, Tooltip } from 'antd';
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import styles from './event-feed.module.css';
import { useFollowerPulse } from './just-followed-pulse.js';
import { TIKTOK_EMOJIS } from './tiktok-emojis.js';

const HEART_ME_GIFT_NAME = 'Heart Me';
const DEFAULT_GIFT_NAME = 'Gift';
const GIFT_REPEAT_MARK = '\u00d7';
const MIN_VISIBLE_GIFT_CHIPS = 2;
const ESTIMATED_GIFT_CHIP_WIDTH = 72;
const SCROLL_BOTTOM_THRESHOLD = 100;
const INDIVIDUAL_FEED_MIN_WIDTH = 240;
const MAIN_FEED_MIN_WIDTH = 320;
const SPLIT_FEED_MIN_WIDTH = INDIVIDUAL_FEED_MIN_WIDTH + MAIN_FEED_MIN_WIDTH;
const FIVE_SECOND_MS = 5_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const FOLLOWER_BADGE_VIEW_BOX = '0 0 24 24';
const FOLLOWER_BADGE_PATH =
	'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';
const CHAT_BUBBLE_TAIL_VIEW_BOX = '0 0 500 500';
const CHAT_BUBBLE_TAIL_PATH =
	'M 7.345 20.273 C 262.053 61.815 213.415 428.641 213.031 501.451 L 499.161 502.063 C 501.472 232.37 386.075 -28.462 7.345 20.273 Z';

type PinnedStage = 'inline' | 'top' | 'bottom';

export interface ChatEventCardProps {
	event: ChatLiveEvent;
	userGiftEvents?: GiftLiveEvent[];
	visibleGiftChipCount?: number;
}

export interface GiftEventCardProps {
	event: GiftLiveEvent;
	userGiftEvents?: GiftLiveEvent[];
}

export interface EventFeedProps {
	chatEvents: ChatLiveEvent[];
	giftEvents: GiftLiveEvent[];
	userGiftEvents?: Map<string, GiftLiveEvent[]>;
}

export interface IndividualChatFeedProps {
	chatEvents: ChatLiveEvent[];
	giftEvents: GiftLiveEvent[];
	pinnedEvent?: FeedLiveEvent;
	userGiftEvents?: Map<string, GiftLiveEvent[]>;
	onPinnedEventChange?: (event: FeedLiveEvent | undefined) => void;
}

export interface ScrollableFeedListProps {
	events: FeedLiveEvent[];
	children: ReactNode;
	className?: string;
	initialScrollTarget?: 'bottom' | string;
	scrollRef?: RefObject<HTMLDivElement | null>;
	onScroll?: () => void;
}

export interface SplitFeedLayoutProps {
	chatEvents: ChatLiveEvent[];
	giftEvents: GiftLiveEvent[];
	userGiftEvents?: Map<string, GiftLiveEvent[]>;
}

interface GiftChipViewModel {
	giftName: string;
	giftImageUrl?: string;
	repeatCount: number;
	totalValue: number;
}

interface GiftImageProps {
	giftImageUrl?: string;
	giftName?: string;
	size: 'small' | 'large';
	tooltipContent?: string;
}

interface NewEventSummary {
	count: number;
	latestEvent: FeedLiveEvent | undefined;
}

interface NewMessagesBarProps {
	count: number;
	latestUnreadEvent: FeedLiveEvent | undefined;
	onClick: () => void;
}

export type FeedLiveEvent = ChatLiveEvent | GiftLiveEvent;

interface EventFeedPanelProps extends EventFeedProps {
	pinnedEvent?: FeedLiveEvent;
	onPinnedEventChange: (event: FeedLiveEvent | undefined) => void;
}

export function ScrollableFeedList({
	events,
	children,
	className,
	initialScrollTarget = 'bottom',
	scrollRef: externalScrollRef,
	onScroll: onScrollProp,
}: ScrollableFeedListProps) {
	const internalRef = useRef<HTMLDivElement>(null);
	const feedRef = externalScrollRef ?? internalRef;
	const previousEventIdsRef = useRef<Set<string> | undefined>(undefined);
	// True once the mount-only effect has positioned the feed. Gates the events
	// effect so a StrictMode remount (refs survive it, so previousEventIdsRef is
	// already populated) doesn't treat its second run as a follow-up and yank the
	// feed to the bottom, clobbering the initialScrollTarget positioning.
	const hasPositionedRef = useRef(false);
	// Ref mirrors isAtBottom state but is updated synchronously in the scroll handler so
	// the events effect reads the pre-render value (not the post-render DOM measurement,
	// which is inflated by the heights of newly-added rows and causes false "not at bottom").
	const isAtBottomRef = useRef(initialScrollTarget === 'bottom');
	const [isAtBottom, setIsAtBottom] = useState(initialScrollTarget === 'bottom');
	const [unreadCount, setUnreadCount] = useState(0);
	const [latestUnreadEvent, setLatestUnreadEvent] = useState<FeedLiveEvent | undefined>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
	useEffect(() => {
		const feed = feedRef.current;

		if (!feed || hasPositionedRef.current) {
			// Position exactly once. Guards against StrictMode's mount double-invoke
			// re-applying a relative scroll offset (which would double it).
			return;
		}
		hasPositionedRef.current = true;

		if (initialScrollTarget === 'bottom') {
			scrollToBottom(feed, 'instant');
			return;
		}

		const target = feed.querySelector(`[data-feed-event-id="${initialScrollTarget}"]`);

		if (target instanceof HTMLElement) {
			const feedRect = feed.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			feed.scrollTop += targetRect.top - feedRect.top;
		} else {
			scrollToBottom(feed, 'instant');
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: feedRef is a ref, not reactive
	useEffect(() => {
		const previousEventIds = previousEventIdsRef.current;
		const isInitialRun = previousEventIds === undefined;
		const newEvents = getNewEventSummary(events, previousEventIds);

		previousEventIdsRef.current = getEventIds(events);

		if (events.length === 0) {
			setUnreadCount(0);
			setLatestUnreadEvent(undefined);
			return;
		}

		// The mount-only effect above already positions the feed (bottom or scroll target).
		// Skip this run so it isn't yanked to the bottom before any new events arrive.
		// Also skip when the event set is unchanged (e.g. a StrictMode remount re-runs this
		// effect with refs already populated): there are no new events to react to, and
		// yanking to the bottom here would clobber the initialScrollTarget positioning.
		if (isInitialRun || newEvents.count === 0) {
			return;
		}

		// Prefer the pre-render ref value over a live DOM measurement: the DOM is already
		// committed with new rows when this effect runs, so a live scrollHeight read is
		// inflated by the heights of newly-added rows and falsely reports "not at bottom"
		// under high-frequency bursts. The ref is written synchronously by the scroll handler
		// before any React re-render, so it reflects the user's position before the burst.
		//
		// Fall back to a live measurement when the ref is false: a non-scrollable feed
		// (e.g. IndividualChatFeed on first open) never fires a scroll event so the ref
		// stays at its initialised value, yet all events are always visible and no bar
		// should appear.
		if (isAtBottomRef.current || isScrolledToBottom(feedRef.current)) {
			scrollToBottom(feedRef.current, 'instant');
			setIsAtBottom(true);
			setUnreadCount(0);
			setLatestUnreadEvent(undefined);
		} else {
			setIsAtBottom(false);
			setUnreadCount((current) => current + newEvents.count);
			setLatestUnreadEvent((current) => newEvents.latestEvent ?? current);
		}
	}, [events]);

	const handleScroll = () => {
		const atBottom = isScrolledToBottom(feedRef.current);
		isAtBottomRef.current = atBottom;
		setIsAtBottom(atBottom);

		if (atBottom) {
			setUnreadCount(0);
			setLatestUnreadEvent(undefined);
		}

		onScrollProp?.();
	};

	const handleNewMessagesClick = () => {
		scrollToBottom(feedRef.current, 'instant');
		isAtBottomRef.current = true;
		setIsAtBottom(true);
		setUnreadCount(0);
		setLatestUnreadEvent(undefined);
	};

	return (
		<div className={styles.feedShell}>
			{unreadCount === 0 && isAtBottom && <AuroraOverlay />}
			<div
				className={`${styles.feed}${className ? ` ${className}` : ''}`}
				data-celestia-event-feed=""
				onScroll={handleScroll}
				ref={feedRef}
			>
				{children}
			</div>
			{unreadCount > 0 ? (
				<NewMessagesBar
					count={unreadCount}
					latestUnreadEvent={latestUnreadEvent}
					onClick={handleNewMessagesClick}
				/>
			) : null}
		</div>
	);
}

function AuroraOverlay() {
	return <div aria-hidden="true" className={styles.aurora} data-celestia-aurora="" />;
}

function NewMessagesBar({ count, latestUnreadEvent, onClick }: NewMessagesBarProps) {
	const previewName = toDisplayName(latestUnreadEvent?.user);
	const previewText = toUnreadPreviewText(latestUnreadEvent);

	return (
		<button
			aria-label={`${count} new messages, scroll down`}
			className={styles.newMessagesBar}
			data-celestia-new-messages-bar=""
			onClick={onClick}
			type="button"
		>
			<span className={styles.newMessagesTopRow}>
				<span className={styles.newMessagesTitle}>
					<span className={styles.newMessagesCount}>{count}</span>
					<span className={styles.newMessagesLabel}>new messages</span>
				</span>
				<span className={styles.newMessagesHint}>scroll down ↓</span>
			</span>
			<span className={styles.newMessagesPreview}>
				<span className={styles.newMessagesPreviewName}>{previewName}</span>
				<span className={styles.newMessagesPreviewText}>{previewText}</span>
			</span>
		</button>
	);
}

export function ChatEventCard({
	event,
	userGiftEvents = [],
	visibleGiftChipCount,
}: ChatEventCardProps) {
	const chipListRef = useRef<HTMLSpanElement>(null);
	const [measuredVisibleChipCount, setMeasuredVisibleChipCount] = useState<number | undefined>(
		visibleGiftChipCount,
	);
	const giftChips = useMemo(() => toGiftChips(userGiftEvents), [userGiftEvents]);
	const heartMeGift = userGiftEvents.find((gift) => gift.giftName === HEART_ME_GIFT_NAME);
	const visibleCount = Math.max(
		MIN_VISIBLE_GIFT_CHIPS,
		visibleGiftChipCount ?? measuredVisibleChipCount ?? giftChips.length,
	);
	const visibleGiftChips = giftChips.slice(0, visibleCount);
	const hiddenGiftCount = Math.max(giftChips.length - visibleGiftChips.length, 0);

	useEffect(() => {
		if (visibleGiftChipCount !== undefined) {
			setMeasuredVisibleChipCount(visibleGiftChipCount);
			return;
		}

		const chipList = chipListRef.current;

		if (!chipList) {
			return;
		}

		const updateVisibleCount = () => {
			const width = chipList.getBoundingClientRect().width;

			if (width <= 0) {
				setMeasuredVisibleChipCount(giftChips.length);
				return;
			}

			setMeasuredVisibleChipCount(
				Math.max(MIN_VISIBLE_GIFT_CHIPS, Math.floor(width / ESTIMATED_GIFT_CHIP_WIDTH)),
			);
		};

		updateVisibleCount();

		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		const observer = new ResizeObserver(updateVisibleCount);
		observer.observe(chipList);

		return () => {
			observer.disconnect();
		};
	}, [giftChips.length, visibleGiftChipCount]);

	return (
		<article className={styles.chatCard}>
			<Avatar user={event.user} badgeGift={heartMeGift} />
			<div className={styles.chatBody}>
				<div className={styles.nicknameLine}>
					<span className={styles.nickname}>{toDisplayName(event.user)}</span>
					<span className={styles.giftChips} ref={chipListRef}>
						{visibleGiftChips.map((gift) => (
							<GiftChip gift={gift} key={gift.giftName} />
						))}
						{hiddenGiftCount > 0 ? (
							<span className={styles.moreGiftChips}>{`+${hiddenGiftCount} more`}</span>
						) : null}
					</span>
				</div>
				<div className={styles.chatContent}>
					<div className={styles.messageBubbleWrapper}>
						<ChatBubbleTail />
						<div className={styles.messageBubble}>
							{renderMessageText(event.text, event.emotes)}
						</div>
					</div>
					<EventTimestamp ts={event.ts} />
				</div>
			</div>
		</article>
	);
}

function ChatBubbleTail() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={CHAT_BUBBLE_TAIL_VIEW_BOX}
			width="16"
			height="16"
			className={styles.bubbleTail}
			aria-hidden="true"
		>
			<path d={CHAT_BUBBLE_TAIL_PATH} />
		</svg>
	);
}

export function GiftEventCard({ event, userGiftEvents = [] }: GiftEventCardProps) {
	const heartMeGift = userGiftEvents.find((gift) => gift.giftName === HEART_ME_GIFT_NAME);
	const repeatCount = toPositiveRepeatCount(event.repeatCount);
	const giftName = event.giftName ?? DEFAULT_GIFT_NAME;
	const giftDiamondTooltip = formatGiftDiamondTooltip(event.diamondCount, repeatCount);

	return (
		<article className={styles.giftEvent}>
			<Avatar user={event.user} badgeGift={heartMeGift} />
			<span className={styles.giftSentence}>
				<span className={styles.giftSenderName}>{toDisplayName(event.user)}</span>
				<span className={styles.giftConnector}> sent a </span>
				<span className={styles.giftName}>{giftName}</span>
			</span>
			<span className={styles.giftItem}>
				<GiftImage
					giftImageUrl={event.giftImageUrl}
					giftName={giftName}
					size="large"
					tooltipContent={giftDiamondTooltip}
				/>
			</span>
			<span className={styles.giftRepeat}>
				<span className={styles.repeatPrefix}>{GIFT_REPEAT_MARK}</span>
				<span className={styles.repeatCount}>{repeatCount.toLocaleString()}</span>
			</span>
			<EventTimestamp className={styles.giftTimestamp} ts={event.ts} />
		</article>
	);
}

export function EventFeed({ chatEvents, giftEvents, userGiftEvents = new Map() }: EventFeedProps) {
	const [pinnedEvent, setPinnedEvent] = useState<FeedLiveEvent | undefined>();

	return (
		<EventFeedPanel
			chatEvents={chatEvents}
			giftEvents={giftEvents}
			userGiftEvents={userGiftEvents}
			pinnedEvent={pinnedEvent}
			onPinnedEventChange={setPinnedEvent}
		/>
	);
}

function EventFeedPanel({
	chatEvents,
	giftEvents,
	userGiftEvents = new Map(),
	pinnedEvent,
	onPinnedEventChange,
}: EventFeedPanelProps) {
	const feedRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const [pinnedNaturalTop, setPinnedNaturalTop] = useState<number | undefined>();
	const [pinnedStage, setPinnedStage] = useState<PinnedStage>('inline');
	const pinnedEventId = pinnedEvent?.id;
	const events = useMemo(
		() => [...chatEvents, ...giftEvents].sort((first, second) => first.ts - second.ts),
		[chatEvents, giftEvents],
	);
	const updatePinnedEvent = useCallback(
		(event: FeedLiveEvent | undefined) => {
			onPinnedEventChange(event);
		},
		[onPinnedEventChange],
	);

	useEffect(() => {
		if (pinnedEventId && !events.some((event) => event.id === pinnedEventId)) {
			updatePinnedEvent(undefined);
			setPinnedNaturalTop(undefined);
			setPinnedStage('inline');
			return;
		}

		setPinnedStage(
			getPinnedStage(
				feedRef.current,
				getPinnedEventRow(rowRefs.current, pinnedEventId),
				pinnedNaturalTop,
			),
		);
	}, [events, pinnedEventId, pinnedNaturalTop, updatePinnedEvent]);

	const handleScroll = () => {
		setPinnedStage(
			getPinnedStage(
				feedRef.current,
				getPinnedEventRow(rowRefs.current, pinnedEventId),
				pinnedNaturalTop,
			),
		);
	};

	const handleEventClick = (eventId: string) => {
		if (eventId !== pinnedEventId) {
			const event = events.find((item) => item.id === eventId);
			const row = rowRefs.current.get(eventId);
			const naturalTop = row?.offsetTop;

			updatePinnedEvent(event);
			setPinnedNaturalTop(naturalTop);
			setPinnedStage(getPinnedStage(feedRef.current, row, naturalTop));
			return;
		}

		if (pinnedStage === 'inline') {
			updatePinnedEvent(undefined);
			setPinnedNaturalTop(undefined);
			return;
		}

		scrollToRowTop(feedRef.current, pinnedNaturalTop);
		setPinnedStage('inline');
	};

	const setRowRef = (eventId: string) => (element: HTMLButtonElement | null) => {
		if (element) {
			rowRefs.current.set(eventId, element);
			return;
		}

		rowRefs.current.delete(eventId);
	};

	return (
		<ScrollableFeedList events={events} scrollRef={feedRef} onScroll={handleScroll}>
			{events.map((event) => (
				<button
					className={getCardRowClassName(event.id === pinnedEventId, pinnedStage)}
					data-event-id={event.id}
					data-feed-event-id={event.id}
					data-pinned={event.id === pinnedEventId ? 'true' : undefined}
					data-sticky-stage={event.id === pinnedEventId ? pinnedStage : undefined}
					key={event.id}
					onClick={() => handleEventClick(event.id)}
					ref={setRowRef(event.id)}
					type="button"
				>
					<FeedEventCard event={event} userGiftEventsByUser={userGiftEvents} />
				</button>
			))}
		</ScrollableFeedList>
	);
}

export function IndividualChatFeed({
	chatEvents,
	giftEvents,
	pinnedEvent,
	userGiftEvents = new Map(),
	onPinnedEventChange,
}: IndividualChatFeedProps) {
	if (!pinnedEvent) {
		return (
			<section
				aria-label="Viewer feed"
				className={styles.individualFeed}
				data-celestia-individual-chat-feed=""
			>
				<div className={styles.individualEmptyState}>
					<div className={styles.individualEmptyIcon} aria-hidden="true">
						💬
					</div>
					<p className={styles.individualEmptyPrimary}>Click a message to open a viewer's feed</p>
					<p className={styles.individualEmptySecondary}>Their messages will appear here</p>
				</div>
			</section>
		);
	}

	const events = [...chatEvents, ...giftEvents]
		.filter((event) => isIndividualFeedEvent(event, pinnedEvent))
		.sort((first, second) => first.ts - second.ts);

	return (
		<section
			aria-label={`${toDisplayName(pinnedEvent.user)} feed`}
			className={styles.individualFeed}
			data-celestia-individual-chat-feed=""
		>
			<Tag
				aria-label={`${toDisplayName(pinnedEvent.user)} feed controls`}
				className={styles.individualViewerPill}
				data-celestia-individual-viewer-pill=""
				icon={<Avatar user={pinnedEvent.user} />}
				closable
				closeIcon={
					<span data-celestia-viewer-pill-dismiss="">
						<CloseOutlined />
					</span>
				}
				onClose={() => onPinnedEventChange?.(undefined)}
			/>
			<ScrollableFeedList
				key={pinnedEvent.user?.userId}
				events={events}
				initialScrollTarget={pinnedEvent.id}
				className={styles.individualFeedScroll}
			>
				{events.map((event) => (
					<div
						className={getIndividualEventRowClassName(event.id === pinnedEvent.id)}
						data-individual-event-id={event.id}
						data-feed-event-id={event.id}
						key={event.id}
					>
						<FeedEventCard event={event} userGiftEventsByUser={userGiftEvents} />
					</div>
				))}
			</ScrollableFeedList>
		</section>
	);
}

export function SplitFeedLayout({
	chatEvents,
	giftEvents,
	userGiftEvents = new Map(),
}: SplitFeedLayoutProps) {
	const layoutRef = useRef<HTMLDivElement>(null);
	const [pinnedEvent, setPinnedEventState] = useState<FeedLiveEvent | undefined>();
	const [isIndividualFeedCollapsed, setIsIndividualFeedCollapsed] = useState(false);

	useEffect(() => {
		const layout = layoutRef.current;

		if (!layout) {
			return;
		}

		const updateCollapsedState = () => {
			setIsIndividualFeedCollapsed(
				layout.clientWidth > 0 && layout.clientWidth < SPLIT_FEED_MIN_WIDTH,
			);
		};

		updateCollapsedState();
		window.addEventListener('resize', updateCollapsedState);

		if (typeof ResizeObserver !== 'undefined') {
			const observer = new ResizeObserver(updateCollapsedState);
			observer.observe(layout);

			return () => {
				observer.disconnect();
				window.removeEventListener('resize', updateCollapsedState);
			};
		}

		return () => {
			window.removeEventListener('resize', updateCollapsedState);
		};
	}, []);

	const mainFeed = (
		<EventFeedPanel
			chatEvents={chatEvents}
			giftEvents={giftEvents}
			userGiftEvents={userGiftEvents}
			pinnedEvent={pinnedEvent}
			onPinnedEventChange={setPinnedEventState}
		/>
	);
	const isIndividualFeedVisible = !isIndividualFeedCollapsed;
	const canUseSplitter = typeof ResizeObserver !== 'undefined';
	const individualFeed = (
		<IndividualChatFeed
			chatEvents={chatEvents}
			giftEvents={giftEvents}
			userGiftEvents={userGiftEvents}
			pinnedEvent={pinnedEvent}
			onPinnedEventChange={setPinnedEventState}
		/>
	);
	let splitFeedContent: ReactNode;

	if (!isIndividualFeedVisible) {
		splitFeedContent = <div data-celestia-split-feed-collapsed="">{mainFeed}</div>;
	} else if (canUseSplitter) {
		splitFeedContent = (
			<Splitter className={styles.splitter} orientation="horizontal">
				<Splitter.Panel min={INDIVIDUAL_FEED_MIN_WIDTH} defaultSize="50%">
					{individualFeed}
				</Splitter.Panel>
				<Splitter.Panel min={MAIN_FEED_MIN_WIDTH}>{mainFeed}</Splitter.Panel>
			</Splitter>
		);
	} else {
		splitFeedContent = (
			<div className={styles.splitterFallback}>
				<div className={styles.individualFallbackPanel}>{individualFeed}</div>
				<div className={styles.mainFallbackPanel}>{mainFeed}</div>
			</div>
		);
	}

	return (
		<div className={styles.splitFeedLayout} data-celestia-split-feed-layout="" ref={layoutRef}>
			{splitFeedContent}
		</div>
	);
}

export interface FeedEventCardProps {
	event: FeedLiveEvent;
	userGiftEventsByUser: Map<string, GiftLiveEvent[]>;
}

export function FeedEventCard({ event, userGiftEventsByUser }: FeedEventCardProps) {
	const userGiftEvents = getUserGiftEvents(userGiftEventsByUser, event.user);

	switch (event.type) {
		case 'chat':
			return <ChatEventCard event={event} userGiftEvents={userGiftEvents} />;
		case 'gift':
			return <GiftEventCard event={event} userGiftEvents={userGiftEvents} />;
	}
}

function getTimestampTickDelay(ts: number): number {
	const now = Date.now();
	const age = Math.max(now - ts, 0);

	if (age < MINUTE_MS) {
		return FIVE_SECOND_MS - (now % FIVE_SECOND_MS);
	}

	if (age < HOUR_MS) {
		return MINUTE_MS - (now % MINUTE_MS);
	}

	return HOUR_MS - (now % HOUR_MS);
}

function isIndividualFeedEvent(event: FeedLiveEvent, pinnedEvent: FeedLiveEvent): boolean {
	if (event.user?.userId && event.user.userId === pinnedEvent.user?.userId) {
		return true;
	}

	if (event.type !== 'chat') {
		return false;
	}

	const viewerNickname = pinnedEvent.user?.nickname;

	if (!viewerNickname) {
		return false;
	}

	return event.text.includes(`@${viewerNickname}`);
}

function getIndividualEventRowClassName(isPinned: boolean): string {
	if (!isPinned) {
		return styles.individualEventRow ?? '';
	}

	return [styles.individualEventRow, styles.pinnedIndividualEventRow]
		.filter((className): className is string => Boolean(className))
		.join(' ');
}

function GiftChip({ gift }: { gift: GiftChipViewModel }) {
	return (
		<span className={styles.giftChip}>
			<GiftImage giftImageUrl={gift.giftImageUrl} giftName={gift.giftName} size="small" />
			<span className={styles.chipX}>x</span>
			<span className={styles.chipCount}>{gift.repeatCount.toLocaleString()}</span>
		</span>
	);
}

function Avatar({ user, badgeGift }: { user?: UserInfo; badgeGift?: GiftLiveEvent }) {
	return (
		<span className={styles.avatarWrap}>
			{user?.avatarUrl ? (
				<img className={styles.avatar} src={user.avatarUrl} alt="" />
			) : (
				<span className={styles.avatarFallback}>{toInitials(toDisplayName(user))}</span>
			)}
			<FollowerBadge user={user} />
			{badgeGift ? (
				<img
					className={styles.heartBadge}
					src={badgeGift.giftImageUrl}
					alt="Heart Me badge"
					title="Heart Me badge"
				/>
			) : null}
		</span>
	);
}

function FollowerBadge({ user }: { user?: UserInfo }) {
	// The "just followed" one-shot (#91). A decoded follow transition both
	// elevates the viewer's standing (`followed`, sticky for the session) and
	// arms the pop + glow (`justFollowed`, transient). Elevating standing means
	// the badge appears on every avatar of that viewer already in the feed - not
	// only on their next message - so the follow is noticed instantly. Hook runs
	// unconditionally (rules of hooks) before the non-follower early-return.
	const { followed, justFollowed } = useFollowerPulse(user);
	const followStatus = user?.followStatus;
	// Binary, silent for non-followers: following (1) and mutual (2) render the
	// same badge; stranger (0) or unknown (undefined) render no DOM node - unless
	// a follow transition this session elevated them (`followed`).
	const isFollower = (followStatus !== undefined && followStatus >= 1) || followed;
	if (!isFollower) return null;
	const className = justFollowed
		? `${styles.followBadge} ${styles.justFollowed}`
		: styles.followBadge;
	return (
		<span
			className={className}
			role="img"
			aria-label="Follows the streamer"
			title="Follows the streamer"
		>
			<svg className={styles.followBadgeThumb} viewBox={FOLLOWER_BADGE_VIEW_BOX} aria-hidden="true">
				<path d={FOLLOWER_BADGE_PATH} />
			</svg>
		</span>
	);
}

function GiftImage({ giftImageUrl, giftName, size, tooltipContent }: GiftImageProps) {
	const className = size === 'small' ? styles.giftImageSmall : styles.giftImageLarge;
	const image = !giftImageUrl ? (
		<span className={`${className} ${styles.giftImageFallback}`} aria-hidden="true" />
	) : (
		<img className={className} src={giftImageUrl} alt={giftName ?? DEFAULT_GIFT_NAME} />
	);

	if (!tooltipContent) {
		return image;
	}

	return (
		<Tooltip title={tooltipContent}>
			<span>{image}</span>
		</Tooltip>
	);
}

function EventTimestamp({ ts, className }: { ts: number; className?: string }) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const tick = () => {
			const currentNow = Date.now();
			setNow(currentNow);
			timeoutId = setTimeout(tick, getTimestampTickDelay(ts));
		};

		timeoutId = setTimeout(tick, getTimestampTickDelay(ts));

		return () => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		};
	}, [ts]);

	return (
		<time className={`${styles.timestamp} ${className ?? ''}`}>
			{formatMinimalTimestamp(ts, now)}
		</time>
	);
}

function toGiftChips(giftEvents: GiftLiveEvent[]): GiftChipViewModel[] {
	const giftsByName = new Map<string, GiftChipViewModel>();
	const giftEventsByGroup = new Map<string, GiftLiveEvent>();
	const ungroupedGiftEvents: GiftLiveEvent[] = [];

	for (const event of giftEvents) {
		if (!event.giftName || event.giftName === HEART_ME_GIFT_NAME) {
			continue;
		}

		if (!event.groupId) {
			ungroupedGiftEvents.push(event);
			continue;
		}

		const current = giftEventsByGroup.get(event.groupId);
		if (
			!current ||
			toPositiveRepeatCount(event.repeatCount) > toPositiveRepeatCount(current.repeatCount)
		) {
			giftEventsByGroup.set(event.groupId, event);
		}
	}

	for (const event of [...giftEventsByGroup.values(), ...ungroupedGiftEvents]) {
		const giftName = event.giftName;

		if (!giftName) {
			continue;
		}

		const repeatCount = toPositiveRepeatCount(event.repeatCount);
		const diamondCount = toNonNegativeDiamondCount(event.diamondCount);
		const current = giftsByName.get(giftName);

		giftsByName.set(giftName, {
			giftName,
			giftImageUrl: current?.giftImageUrl ?? event.giftImageUrl,
			repeatCount: (current?.repeatCount ?? 0) + repeatCount,
			totalValue: (current?.totalValue ?? 0) + diamondCount * repeatCount,
		});
	}

	return [...giftsByName.values()].sort((first, second) => second.totalValue - first.totalValue);
}

function toPositiveRepeatCount(repeatCount: number | undefined): number {
	return Math.max(repeatCount ?? 1, 1);
}

function toNonNegativeDiamondCount(diamondCount: number | undefined): number {
	return Math.max(diamondCount ?? 0, 0);
}

function formatGiftDiamondTooltip(
	diamondCount: number | undefined,
	repeatCount: number,
): string | undefined {
	const diamondsPerGift = toNonNegativeDiamondCount(diamondCount);

	if (diamondsPerGift === 0) {
		return undefined;
	}

	const totalDiamonds = diamondsPerGift * repeatCount;

	return `${totalDiamonds.toLocaleString()} diamonds (${diamondsPerGift.toLocaleString()} each)`;
}

type TextPart =
	| { kind: 'text'; value: string; start: number }
	| { kind: 'mention'; value: string; start: number }
	| { kind: 'emote'; name: string; src: string; start: number };

type Splice =
	| { kind: 'mention'; start: number; end: number; value: string }
	| { kind: 'emote'; start: number; end: number; name: string; src: string };

function renderMessageText(text: string, emotes?: EmoteInfo[]) {
	return buildParts(text, emotes).map((part) => {
		if (part.kind === 'mention') {
			return (
				<span className={styles.mention} key={`m${part.start}`}>
					{part.value}
				</span>
			);
		}
		if (part.kind === 'emote') {
			return (
				<img
					key={`e${part.start}`}
					className={styles.emote}
					src={part.src}
					alt={`[${part.name}]`}
				/>
			);
		}
		return part.value;
	});
}

function buildParts(text: string, emotes?: EmoteInfo[]): TextPart[] {
	const splices: Splice[] = [];

	for (const match of text.matchAll(/@[\w.-]+/g)) {
		splices.push({
			kind: 'mention',
			start: match.index,
			end: match.index + match[0].length,
			value: match[0],
		});
	}

	for (const match of text.matchAll(/\[(\w+)\]/g)) {
		const name = match[1];
		if (!name) continue;
		const src = TIKTOK_EMOJIS[name];
		if (src) {
			splices.push({
				kind: 'emote',
				start: match.index,
				end: match.index + match[0].length,
				name,
				src,
			});
		}
	}

	if (emotes) {
		for (const emote of emotes) {
			const pos = emote.placeInComment;
			if (pos === undefined || pos < 0 || pos >= text.length) continue;
			if (text[pos] !== ' ') continue;
			const src = TIKTOK_EMOJIS[emote.emoteId] || emote.imageUrl || '';
			if (!src) continue;
			splices.push({ kind: 'emote', start: pos, end: pos + 1, name: emote.emoteId, src });
		}
	}

	splices.sort((a, b) => a.start - b.start);

	const parts: TextPart[] = [];
	let cursor = 0;

	for (const splice of splices) {
		if (splice.start < cursor) continue;
		if (splice.start > cursor) {
			parts.push({ kind: 'text', value: text.slice(cursor, splice.start), start: cursor });
		}
		parts.push(
			splice.kind === 'mention'
				? { kind: 'mention', value: splice.value, start: splice.start }
				: { kind: 'emote', name: splice.name, src: splice.src, start: splice.start },
		);
		cursor = splice.end;
	}

	if (cursor < text.length) {
		parts.push({ kind: 'text', value: text.slice(cursor), start: cursor });
	}

	return parts;
}

function getUserGiftEvents(
	userGiftEvents: Map<string, GiftLiveEvent[]>,
	user?: UserInfo,
): GiftLiveEvent[] {
	const keys = [user?.userId, user?.uniqueId, user?.secUid].filter((value): value is string =>
		Boolean(value),
	);

	for (const key of keys) {
		const events = userGiftEvents.get(key);

		if (events) {
			return events;
		}
	}

	return [];
}

function toDisplayName(user?: UserInfo): string {
	return user?.nickname || user?.uniqueId || 'Anonymous';
}

function toInitials(name: string): string {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

function isScrolledToBottom(element: HTMLElement | null): boolean {
	if (!element) {
		return true;
	}

	return element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
}

function getEventIds(events: FeedLiveEvent[]): Set<string> {
	return new Set(events.map((event) => event.id));
}

function getNewEventSummary(
	events: FeedLiveEvent[],
	previousEventIds: Set<string> | undefined,
): NewEventSummary {
	if (!previousEventIds) {
		return { count: 0, latestEvent: undefined };
	}

	let count = 0;
	let latestEvent: FeedLiveEvent | undefined;

	for (const event of events) {
		if (previousEventIds.has(event.id)) {
			continue;
		}

		count += 1;
		latestEvent = event;
	}

	return { count, latestEvent };
}

function toUnreadPreviewText(event: FeedLiveEvent | undefined): string {
	if (!event) {
		return '';
	}

	if (event.type === 'chat') {
		return event.text;
	}

	return `sent ${event.giftName || DEFAULT_GIFT_NAME}`;
}

function scrollToBottom(element: HTMLElement | null, behavior: 'smooth' | 'instant'): void {
	if (!element) {
		return;
	}
	element.scrollTo({ top: element.scrollHeight, behavior });
}

function getPinnedEventRow(
	rowRefs: Map<string, HTMLButtonElement>,
	pinnedEventId: string | undefined,
): HTMLButtonElement | undefined {
	if (!pinnedEventId) {
		return undefined;
	}

	return rowRefs.get(pinnedEventId);
}

function getCardRowClassName(isPinned: boolean, pinnedStage: PinnedStage): string {
	if (!isPinned) {
		return styles.cardRow ?? '';
	}

	const classNames = [styles.cardRow, styles.pinnedCardRow].filter(
		(className): className is string => Boolean(className),
	);

	switch (pinnedStage) {
		case 'top':
			if (styles.stickyTopCardRow) {
				classNames.push(styles.stickyTopCardRow);
			}
			break;
		case 'bottom':
			if (styles.stickyBottomCardRow) {
				classNames.push(styles.stickyBottomCardRow);
			}
			break;
		case 'inline':
			break;
	}

	return classNames.join(' ');
}

function getPinnedStage(
	feed: HTMLElement | null,
	row: HTMLElement | undefined,
	rowNaturalTop: number | undefined,
): PinnedStage {
	if (!feed || !row || rowNaturalTop === undefined) {
		return 'inline';
	}

	const rowTop = rowNaturalTop;
	const rowBottom = rowTop + row.offsetHeight;
	const viewportTop = feed.scrollTop;
	const viewportBottom = viewportTop + feed.clientHeight;

	if (rowTop < viewportTop) {
		return 'top';
	}

	if (rowBottom > viewportBottom) {
		return 'bottom';
	}

	return 'inline';
}

function scrollToRowTop(feed: HTMLElement | null, rowTop: number | undefined): void {
	if (!feed || rowTop === undefined) {
		return;
	}

	feed.scrollTop = rowTop;
}

function formatMinimalTimestamp(ts: number, now: number): string {
	const elapsedSeconds = Math.max(Math.floor((now - ts) / 1000), 0);

	if (elapsedSeconds < 5) {
		return 'now';
	}

	if (elapsedSeconds < 60) {
		return `${elapsedSeconds}s`;
	}

	const elapsedMinutes = Math.floor(elapsedSeconds / 60);

	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);

	if (elapsedHours < 24) {
		return `${elapsedHours}h`;
	}

	if (elapsedHours < 48) {
		return 'yesterday';
	}

	const elapsedDays = Math.floor(elapsedHours / 24);

	if (elapsedDays < 7) {
		return `${elapsedDays}d`;
	}

	const elapsedWeeks = Math.floor(elapsedDays / 7);

	if (elapsedWeeks < 12) {
		return `${elapsedWeeks}w`;
	}

	const elapsedMonths = Math.floor(elapsedDays / 30);

	if (elapsedMonths < 12) {
		return `${elapsedMonths}mo`;
	}

	return `${Math.floor(elapsedDays / 365)}y`;
}
