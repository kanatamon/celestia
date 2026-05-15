import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import { useLiveEventStore } from './live-event-store';

type GiftCountInfo = {
	id: LiveGiftMessage['giftId'];
	giftDetails: LiveGiftMessage;
	count: number;
};

/**
 * Certain gifts, such as "Heart Me," are always associated with a groupId of '0'.
 * To guarantee uniqueness, the msgId is used for these gifts instead.
 */
const getUniqueGiftGroupId = (gift: LiveGiftMessage) => {
	return gift.groupId === '0' ? gift.msgId : gift.groupId;
};

export const aggregateGiftCounts = (events: LiveGiftMessage[]) => {
	const seenGroupIds = new Set<LiveGiftMessage['groupId']>();
	type Gifts = Map<LiveGiftMessage['giftId'], GiftCountInfo>;
	const gifts = events.reduceRight<Gifts>((acc, gift) => {
		const existing = acc.get(gift.giftId);
		const previousCount = existing?.count || 0;
		if (!seenGroupIds.has(getUniqueGiftGroupId(gift))) {
			seenGroupIds.add(getUniqueGiftGroupId(gift));
			acc.set(gift.giftId, {
				id: gift.giftId,
				giftDetails: gift,
				count: previousCount + gift.repeatCount,
			});
		}
		return acc;
	}, new Map());
	return Array.from(gifts.values()).sort(compareGiftsByTotalCostDesc);
};

export const compareGiftsByTotalCostDesc = (
	a: GiftCountInfo,
	b: GiftCountInfo,
) => {
	const aCost = a.giftDetails.diamondCount * a.count;
	const bCost = b.giftDetails.diamondCount * b.count;
	return bCost - aCost;
};

export const useGiftCounts = () => {
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);
	return aggregateGiftCounts([...userGiftEvents.values()].flat());
};

const _giftCountsCache = new Map<
	string,
	{
		eventsKey: string;
		result: {
			heartMeGift: GiftCountInfo | undefined;
			paidGifts: GiftCountInfo[];
		};
	}
>();

const _createEventsKey = (events: LiveGiftMessage[]) => {
	return events.map((e) => `${e.giftId}=${e.repeatCount}`).join(':');
};

const getUserGiftCounts = (userId: string, events: LiveGiftMessage[]) => {
	// Check if cache exists and events are the same
	const cached = _giftCountsCache.get(userId);
	if (cached && cached.eventsKey === _createEventsKey(events)) {
		return cached.result;
	}

	// Compute new result
	const aggregatedGiftCounts = aggregateGiftCounts(events);
	const heartMeGift = aggregatedGiftCounts.find(
		(gift) => gift.giftDetails.giftName === 'Heart Me',
	);
	const paidGifts = aggregatedGiftCounts.filter(
		(gift) => gift.giftDetails.giftName !== 'Heart Me',
	);

	const result = { heartMeGift, paidGifts };

	// Update cache (overwrites previous cache for this user)
	_giftCountsCache.set(userId, { eventsKey: _createEventsKey(events), result });

	return result;
};

export const useUserGiftCounts = (userId: string) => {
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);
	const giftEvents = userGiftEvents.get(userId);
	if (!giftEvents) {
		return { heartMeGift: undefined, paidGifts: [] };
	}
	return getUserGiftCounts(userId, giftEvents);
};
