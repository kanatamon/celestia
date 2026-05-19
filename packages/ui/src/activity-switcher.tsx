import { GiftOutlined, LoginOutlined } from '@ant-design/icons';
import type { GiftLiveEvent, MemberLiveEvent, UserInfo } from '@celestia/tiktok-live-core';
import { useMemo, useState } from 'react';
import styles from './activity-switcher.module.css';

export type ActivitySwitcherView = 'join' | 'gifts';

export interface ActivitySwitcherProps {
	memberEvents: MemberLiveEvent[];
	giftEvents: GiftLiveEvent[];
	initialView?: ActivitySwitcherView;
}

interface GiftParadeItem {
	giftName: string;
	giftImageUrl?: string;
	repeatCount: number;
	totalValue: number;
}

export function ActivitySwitcher({
	memberEvents,
	giftEvents,
	initialView = 'join',
}: ActivitySwitcherProps) {
	const [view, setView] = useState<ActivitySwitcherView>(initialView);
	const latestMemberEvent = useMemo(() => getLatestMemberEvent(memberEvents), [memberEvents]);
	const giftItems = useMemo(() => toGiftParadeItems(giftEvents), [giftEvents]);
	const tickerSignature = giftItems
		.map((item) => `${item.giftName}:${item.repeatCount}:${item.totalValue}`)
		.join('|');
	const isJoinView = view === 'join';

	const handleToggle = () => {
		setView((currentView) => (currentView === 'join' ? 'gifts' : 'join'));
	};

	return (
		<button
			aria-label={isJoinView ? 'Show gift parade' : 'Show join activity'}
			className={`${styles.switcher} ${isJoinView ? styles.joinTheme : styles.giftTheme}`}
			data-celestia-activity-switcher=""
			type="button"
			onClick={handleToggle}
		>
			<span className={styles.iconBadge} aria-hidden="true">
				{isJoinView ? <LoginOutlined /> : <GiftOutlined />}
			</span>
			<span className={styles.content}>
				{isJoinView ? (
					<JoinContent event={latestMemberEvent} />
				) : (
					<GiftParade items={giftItems} tickerSignature={tickerSignature} />
				)}
			</span>
			<span className={styles.indicator} aria-hidden="true">
				<span
					className={`${styles.dot} ${isJoinView ? styles.activeDot : ''}`}
					data-active={isJoinView}
					data-activity-dot=""
				/>
				<span
					className={`${styles.dot} ${!isJoinView ? styles.activeDot : ''}`}
					data-active={!isJoinView}
					data-activity-dot=""
				/>
			</span>
		</button>
	);
}

function JoinContent({ event }: { event?: MemberLiveEvent }) {
	if (!event) {
		return <span className={styles.placeholder}>Waiting for viewers...</span>;
	}

	return (
		<span className={styles.joinText}>
			<strong>{toDisplayName(event.user)}</strong>
			<span> joined</span>
		</span>
	);
}

function GiftParade({
	items,
	tickerSignature,
}: {
	items: GiftParadeItem[];
	tickerSignature: string;
}) {
	if (items.length === 0) {
		return <span className={styles.placeholder}>No gifts yet...</span>;
	}

	return (
		<span className={styles.tickerViewport}>
			<span
				className={styles.tickerTrack}
				data-celestia-gift-ticker=""
				data-ticker-signature={tickerSignature}
				key={tickerSignature}
			>
				{items.map((item) => (
					<GiftParadeChip item={item} key={item.giftName} />
				))}
				{items.map((item) => (
					<GiftParadeChip ariaHidden item={item} key={`${item.giftName}-duplicate`} />
				))}
			</span>
		</span>
	);
}

function GiftParadeChip({
	item,
	ariaHidden = false,
}: {
	item: GiftParadeItem;
	ariaHidden?: boolean;
}) {
	return (
		<span className={styles.giftItem} aria-hidden={ariaHidden}>
			{item.giftImageUrl ? (
				<img className={styles.giftImage} src={item.giftImageUrl} alt={item.giftName} />
			) : (
				<span className={styles.giftImageFallback} aria-hidden="true" />
			)}
			<span className={styles.giftName}>{item.giftName}</span>
			<span className={styles.giftX}>x</span>
			<span className={styles.giftCount}>{item.repeatCount.toLocaleString()}</span>
		</span>
	);
}

function getLatestMemberEvent(memberEvents: MemberLiveEvent[]): MemberLiveEvent | undefined {
	return memberEvents.reduce<MemberLiveEvent | undefined>((latestEvent, event) => {
		if (!latestEvent || event.ts > latestEvent.ts) {
			return event;
		}

		return latestEvent;
	}, undefined);
}

function toGiftParadeItems(giftEvents: GiftLiveEvent[]): GiftParadeItem[] {
	const giftsByName = new Map<string, GiftParadeItem>();

	for (const event of giftEvents) {
		const giftName = event.giftName ?? 'Gift';
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

function toDisplayName(user?: UserInfo): string {
	return user?.nickname || user?.uniqueId || 'Anonymous';
}

function toPositiveRepeatCount(repeatCount: number | undefined): number {
	return Math.max(repeatCount ?? 1, 1);
}

function toNonNegativeDiamondCount(diamondCount: number | undefined): number {
	return Math.max(diamondCount ?? 0, 0);
}
