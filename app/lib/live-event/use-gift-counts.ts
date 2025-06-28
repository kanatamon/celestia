import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import { useLiveEventStore } from './live-event-store';

/**
 * Certain gifts, such as "Heart Me," are always associated with a groupId of '0'.
 * To guarantee uniqueness, the msgId is used for these gifts instead.
 */
const getUniqueGiftGroupId = (gift: LiveGiftMessage) => {
	return gift.groupId === '0' ? gift.msgId : gift.groupId;
};

export const aggregateGiftCounts = (events: LiveGiftMessage[]) => {
	const seenGroupIds = new Set<LiveGiftMessage['groupId']>();
	type Gifts = Map<
		LiveGiftMessage['giftId'],
		{
			id: LiveGiftMessage['giftId'];
			giftDetails: LiveGiftMessage;
			count: number;
		}
	>;
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
	return Array.from(gifts.values());
};

export const useGiftCounts = () => {
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);
	const giftCounts = [
		...aggregateGiftCounts([...userGiftEvents.values()].flat()),
	].sort((a, b) => {
		const aCost = a.giftDetails.diamondCount * a.count;
		const bCost = b.giftDetails.diamondCount * b.count;
		return bCost - aCost;
	});
	return giftCounts;
};

export const useUserGiftCounts = (userId: string) => {
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);
	const giftEvents = userGiftEvents.get(userId);
	return giftEvents ? aggregateGiftCounts(giftEvents) : [];
};
