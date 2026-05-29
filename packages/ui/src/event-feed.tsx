import type { ChatLiveEvent, GiftLiveEvent, UserInfo } from '@celestia/tiktok-live-core';
import { FloatButton, Splitter, Tag, Tooltip } from 'antd';
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

const HEART_ME_GIFT_NAME = 'Heart Me';
const DEFAULT_GIFT_NAME = 'Gift';
const GIFT_REPEAT_MARK = '\u00d7';
const MIN_VISIBLE_GIFT_CHIPS = 2;
const ESTIMATED_GIFT_CHIP_WIDTH = 72;
const SCROLL_BOTTOM_THRESHOLD = 100;
const INDIVIDUAL_FEED_MIN_WIDTH = 240;
const MAIN_FEED_MIN_WIDTH = 320;
const SPLIT_FEED_MIN_WIDTH = INDIVIDUAL_FEED_MIN_WIDTH + MAIN_FEED_MIN_WIDTH;
const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const CHAT_BUBBLE_TAIL_VIEW_BOX = '0 0 500 500';
const CHAT_BUBBLE_TAIL_PATH =
	'M 7.345 20.273 C 262.053 61.815 213.415 428.641 213.031 501.451 L 499.161 502.063 C 501.472 232.37 386.075 -28.462 7.345 20.273 Z';

type PinnedStage = 'inline' | 'top' | 'bottom';

export interface ChatEventCardProps {
	event: ChatLiveEvent;
	userGiftEvents?: GiftLiveEvent[];
	visibleGiftChipCount?: number;
	now?: number;
}

export interface GiftEventCardProps {
	event: GiftLiveEvent;
	userGiftEvents?: GiftLiveEvent[];
	now?: number;
}

export interface EventFeedProps {
	chatEvents: ChatLiveEvent[];
	giftEvents: GiftLiveEvent[];
	userGiftEvents?: Map<string, GiftLiveEvent[]>;
	now?: number;
	pinnedEventId?: string;
	onPinnedEventChange?: (event: FeedLiveEvent | undefined) => void;
}

export interface IndividualChatFeedProps {
	chatEvents: ChatLiveEvent[];
	giftEvents: GiftLiveEvent[];
	pinnedEvent?: FeedLiveEvent;
	userGiftEvents?: Map<string, GiftLiveEvent[]>;
	now?: number;
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
	now?: number;
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

export type FeedLiveEvent = ChatLiveEvent | GiftLiveEvent;

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
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [unreadCount, setUnreadCount] = useState(0);
	const newMessagesLabel = `↓ ${unreadCount} new messages`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
	useEffect(() => {
		const feed = feedRef.current;

		if (!feed) {
			return;
		}

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
		const newEventCount = countNewEvents(events, previousEventIds);

		previousEventIdsRef.current = getEventIds(events);

		if (events.length === 0) {
			setUnreadCount(0);
			return;
		}

		if (isAtBottom) {
			scrollToBottom(feedRef.current, 'smooth');
			setUnreadCount(0);
		} else {
			setUnreadCount((current) => current + newEventCount);
		}
	}, [events, isAtBottom]);

	const handleScroll = () => {
		const nextIsAtBottom = isScrolledToBottom(feedRef.current);
		setIsAtBottom(nextIsAtBottom);

		if (nextIsAtBottom) {
			setUnreadCount(0);
		}

		onScrollProp?.();
	};

	const handleNewMessagesClick = () => {
		scrollToBottom(feedRef.current, 'instant');
		setIsAtBottom(true);
		setUnreadCount(0);
	};

	return (
		<div className={styles.feedShell}>
			<div
				className={`${styles.feed}${className ? ` ${className}` : ''}`}
				data-celestia-event-feed=""
				onScroll={handleScroll}
				ref={feedRef}
			>
				{children}
			</div>
			{unreadCount > 0 ? (
				<FloatButton
					className={styles.newMessagesButton}
					description={newMessagesLabel}
					onClick={handleNewMessagesClick}
					shape="square"
					styles={{
						root: {
							borderRadius: '100px',
						},
					}}
					style={{
						position: 'absolute',
						insetInlineEnd: 'auto',
						bottom: 14,
						left: '50%',
						transform: 'translateX(-50%)',
					}}
				/>
			) : null}
		</div>
	);
}

export function ChatEventCard({
	event,
	userGiftEvents = [],
	visibleGiftChipCount,
	now = Date.now(),
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
					<div className={styles.messageBubble}>
						<ChatBubbleTail />
						{renderMessageText(event.text)}
					</div>
					<EventTimestamp ts={event.ts} now={now} />
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

export function GiftEventCard({
	event,
	userGiftEvents = [],
	now = Date.now(),
}: GiftEventCardProps) {
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
			<EventTimestamp className={styles.giftTimestamp} ts={event.ts} now={now} />
		</article>
	);
}

export function EventFeed({
	chatEvents,
	giftEvents,
	userGiftEvents = new Map(),
	now = Date.now(),
	pinnedEventId: controlledPinnedEventId,
	onPinnedEventChange,
}: EventFeedProps) {
	const feedRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const [uncontrolledPinnedEventId, setUncontrolledPinnedEventId] = useState<string | undefined>();
	const [pinnedNaturalTop, setPinnedNaturalTop] = useState<number | undefined>();
	const [pinnedStage, setPinnedStage] = useState<PinnedStage>('inline');
	const pinnedEventId = controlledPinnedEventId ?? uncontrolledPinnedEventId;
	const events = useMemo(
		() => [...chatEvents, ...giftEvents].sort((first, second) => first.ts - second.ts),
		[chatEvents, giftEvents],
	);
	const updatePinnedEvent = useCallback(
		(event: FeedLiveEvent | undefined) => {
			setUncontrolledPinnedEventId(event?.id);
			onPinnedEventChange?.(event);
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
					<FeedEventCard event={event} now={now} userGiftEventsByUser={userGiftEvents} />
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
	now = Date.now(),
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
				className={styles.individualViewerPill}
				data-celestia-individual-viewer-pill=""
				icon={<Avatar user={pinnedEvent.user} />}
				closable
				onClose={() => onPinnedEventChange?.(undefined)}
			>
				{toDisplayName(pinnedEvent.user)}
			</Tag>
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
						<FeedEventCard event={event} now={now} userGiftEventsByUser={userGiftEvents} />
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
	now,
}: SplitFeedLayoutProps) {
	const layoutRef = useRef<HTMLDivElement>(null);
	const [pinnedEvent, setPinnedEventState] = useState<FeedLiveEvent | undefined>();
	const [isIndividualFeedCollapsed, setIsIndividualFeedCollapsed] = useState(false);
	const latestEventTimestamp = useMemo(
		() => getLatestEventTimestamp(chatEvents, giftEvents),
		[chatEvents, giftEvents],
	);
	const liveNow = useLiveTimestampNow(latestEventTimestamp);
	const displayNow = now ?? liveNow;

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
		<EventFeed
			chatEvents={chatEvents}
			giftEvents={giftEvents}
			userGiftEvents={userGiftEvents}
			now={displayNow}
			pinnedEventId={pinnedEvent?.id}
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
			now={displayNow}
			onPinnedEventChange={setPinnedEventState}
		/>
	);
	let splitFeedContent: ReactNode;

	if (!isIndividualFeedVisible) {
		splitFeedContent = <div data-celestia-split-feed-collapsed="">{mainFeed}</div>;
	} else if (canUseSplitter) {
		splitFeedContent = (
			<Splitter className={styles.splitter} orientation="horizontal">
				<Splitter.Panel min={INDIVIDUAL_FEED_MIN_WIDTH} defaultSize="42%">
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
	now: number;
	userGiftEventsByUser: Map<string, GiftLiveEvent[]>;
}

export function FeedEventCard({ event, now, userGiftEventsByUser }: FeedEventCardProps) {
	const userGiftEvents = getUserGiftEvents(userGiftEventsByUser, event.user);

	switch (event.type) {
		case 'chat':
			return <ChatEventCard event={event} userGiftEvents={userGiftEvents} now={now} />;
		case 'gift':
			return <GiftEventCard event={event} userGiftEvents={userGiftEvents} now={now} />;
	}
}

function useLiveTimestampNow(latestEventTimestamp: number): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const scheduleNextTick = () => {
			const currentNow = Date.now();
			setNow(currentNow);
			timeoutId = setTimeout(
				scheduleNextTick,
				getNextTimestampDelay(currentNow, latestEventTimestamp),
			);
		};

		timeoutId = setTimeout(
			scheduleNextTick,
			getNextTimestampDelay(Date.now(), latestEventTimestamp),
		);

		return () => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		};
	}, [latestEventTimestamp]);

	return now;
}

function getNextTimestampDelay(now: number, latestEventTimestamp: number): number {
	const age = Math.max(now - latestEventTimestamp, 0);

	if (age < MINUTE_MS) {
		return SECOND_MS - (now % SECOND_MS);
	}

	if (age < HOUR_MS) {
		return MINUTE_MS - (now % MINUTE_MS);
	}

	return HOUR_MS - (now % HOUR_MS);
}

function getLatestEventTimestamp(chatEvents: ChatLiveEvent[], giftEvents: GiftLiveEvent[]): number {
	let latestEventTimestamp = 0;

	for (const event of chatEvents) {
		latestEventTimestamp = Math.max(latestEventTimestamp, event.ts);
	}

	for (const event of giftEvents) {
		latestEventTimestamp = Math.max(latestEventTimestamp, event.ts);
	}

	return latestEventTimestamp;
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

function EventTimestamp({ ts, now, className }: { ts: number; now: number; className?: string }) {
	return (
		<time className={`${styles.timestamp} ${className ?? ''}`}>
			{formatMinimalTimestamp(ts, now)}
		</time>
	);
}

function toGiftChips(giftEvents: GiftLiveEvent[]): GiftChipViewModel[] {
	const giftsByName = new Map<string, GiftChipViewModel>();

	for (const event of giftEvents) {
		if (!event.giftName || event.giftName === HEART_ME_GIFT_NAME) {
			continue;
		}

		const repeatCount = toPositiveRepeatCount(event.repeatCount);
		const diamondCount = toNonNegativeDiamondCount(event.diamondCount);
		const current = giftsByName.get(event.giftName);

		giftsByName.set(event.giftName, {
			giftName: event.giftName,
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

function renderMessageText(text: string) {
	const parts: Array<string | { key: string; value: string }> = [];
	const mentionPattern = /@[\w.-]+/g;
	let lastIndex = 0;

	for (const match of text.matchAll(mentionPattern)) {
		const mention = match[0];
		const index = match.index;

		if (index > lastIndex) {
			parts.push(text.slice(lastIndex, index));
		}

		parts.push({ key: `${mention}-${index}`, value: mention });
		lastIndex = index + mention.length;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts.map((part) =>
		typeof part === 'string' ? (
			part
		) : (
			<span className={styles.mention} key={part.key}>
				{part.value}
			</span>
		),
	);
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

function countNewEvents(
	events: FeedLiveEvent[],
	previousEventIds: Set<string> | undefined,
): number {
	if (!previousEventIds) {
		return 0;
	}

	return events.filter((event) => !previousEventIds.has(event.id)).length;
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
