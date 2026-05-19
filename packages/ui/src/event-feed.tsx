import type { ChatLiveEvent, GiftLiveEvent, UserInfo } from '@celestia/tiktok-live-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './event-feed.module.css';

const HEART_ME_GIFT_NAME = 'Heart Me';
const MIN_VISIBLE_GIFT_CHIPS = 2;
const ESTIMATED_GIFT_CHIP_WIDTH = 72;
const SCROLL_BOTTOM_THRESHOLD = 24;

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
}

interface GiftChipViewModel {
	giftName: string;
	giftImageUrl?: string;
	repeatCount: number;
	totalValue: number;
}

type FeedLiveEvent = ChatLiveEvent | GiftLiveEvent;

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
						<span className={styles.bubblePointer} aria-hidden="true" />
						{renderMessageText(event.text)}
					</div>
					<EventTimestamp ts={event.ts} now={now} />
				</div>
			</div>
		</article>
	);
}

export function GiftEventCard({
	event,
	userGiftEvents = [],
	now = Date.now(),
}: GiftEventCardProps) {
	const heartMeGift = userGiftEvents.find((gift) => gift.giftName === HEART_ME_GIFT_NAME);
	const diamondCount = toNonNegativeDiamondCount(event.diamondCount);
	const repeatCount = toPositiveRepeatCount(event.repeatCount);

	return (
		<article className={styles.giftEvent}>
			<div className={styles.giftCard}>
				<Avatar user={event.user} badgeGift={heartMeGift} />
				<div className={styles.giftViewer}>
					<span className={styles.nickname}>{toDisplayName(event.user)}</span>
					<span className={styles.diamondLabel}>
						{diamondCount.toLocaleString()} {diamondCount === 1 ? 'diamond' : 'diamonds'}
					</span>
				</div>
				<GiftImage giftImageUrl={event.giftImageUrl} giftName={event.giftName} size="large" />
				<span className={styles.screenReaderOnly}>{event.giftName ?? 'Gift'}</span>
				<div className={styles.giftRepeat}>
					<span className={styles.repeatPrefix}>x</span>
					<span className={styles.repeatCount}>{repeatCount.toLocaleString()}</span>
				</div>
			</div>
			<EventTimestamp ts={event.ts} now={now} className={styles.giftTimestamp} />
		</article>
	);
}

export function EventFeed({
	chatEvents,
	giftEvents,
	userGiftEvents = new Map(),
	now = Date.now(),
}: EventFeedProps) {
	const feedRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef(new Map<string, HTMLButtonElement>());
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [showNewMessages, setShowNewMessages] = useState(false);
	const [pinnedEventId, setPinnedEventId] = useState<string | undefined>();
	const [pinnedNaturalTop, setPinnedNaturalTop] = useState<number | undefined>();
	const [pinnedStage, setPinnedStage] = useState<PinnedStage>('inline');
	const events = useMemo(
		() => [...chatEvents, ...giftEvents].sort((first, second) => first.ts - second.ts),
		[chatEvents, giftEvents],
	);

	useEffect(() => {
		if (events.length === 0) {
			setShowNewMessages(false);
			return;
		}

		if (isAtBottom) {
			scrollToBottom(feedRef.current);
			setShowNewMessages(false);
		} else {
			setShowNewMessages(true);
		}
	}, [events.length, isAtBottom]);

	useEffect(() => {
		if (pinnedEventId && !events.some((event) => event.id === pinnedEventId)) {
			setPinnedEventId(undefined);
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
	}, [events, pinnedEventId, pinnedNaturalTop]);

	const handleScroll = () => {
		const nextIsAtBottom = isScrolledToBottom(feedRef.current);
		setIsAtBottom(nextIsAtBottom);

		if (nextIsAtBottom) {
			setShowNewMessages(false);
		}

		setPinnedStage(
			getPinnedStage(
				feedRef.current,
				getPinnedEventRow(rowRefs.current, pinnedEventId),
				pinnedNaturalTop,
			),
		);
	};

	const handleNewMessagesClick = () => {
		scrollToBottom(feedRef.current);
		setIsAtBottom(true);
		setShowNewMessages(false);
	};

	const handleEventClick = (eventId: string) => {
		if (eventId !== pinnedEventId) {
			const row = rowRefs.current.get(eventId);
			const naturalTop = row?.offsetTop;

			setPinnedEventId(eventId);
			setPinnedNaturalTop(naturalTop);
			setPinnedStage(getPinnedStage(feedRef.current, row, naturalTop));
			return;
		}

		if (pinnedStage === 'inline') {
			setPinnedEventId(undefined);
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
		<div className={styles.feedShell}>
			<div
				className={styles.feed}
				data-celestia-event-feed=""
				onScroll={handleScroll}
				ref={feedRef}
			>
				{events.map((event) => (
					<button
						className={getCardRowClassName(event.id === pinnedEventId, pinnedStage)}
						data-event-id={event.id}
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
			</div>
			{showNewMessages ? (
				<button className={styles.newMessagesButton} type="button" onClick={handleNewMessagesClick}>
					New messages
				</button>
			) : null}
		</div>
	);
}

function FeedEventCard({
	event,
	now,
	userGiftEventsByUser,
}: {
	event: FeedLiveEvent;
	now: number;
	userGiftEventsByUser: Map<string, GiftLiveEvent[]>;
}) {
	const userGiftEvents = getUserGiftEvents(userGiftEventsByUser, event.user);

	switch (event.type) {
		case 'chat':
			return <ChatEventCard event={event} userGiftEvents={userGiftEvents} now={now} />;
		case 'gift':
			return <GiftEventCard event={event} userGiftEvents={userGiftEvents} now={now} />;
	}
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

function GiftImage({
	giftImageUrl,
	giftName,
	size,
}: {
	giftImageUrl?: string;
	giftName?: string;
	size: 'small' | 'large';
}) {
	const className = size === 'small' ? styles.giftImageSmall : styles.giftImageLarge;

	if (!giftImageUrl) {
		return <span className={`${className} ${styles.giftImageFallback}`} aria-hidden="true" />;
	}

	return <img className={className} src={giftImageUrl} alt={giftName ?? 'Gift'} />;
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

function scrollToBottom(element: HTMLElement | null): void {
	if (!element) {
		return;
	}

	element.scrollTop = element.scrollHeight;
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
