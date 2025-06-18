import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import { useLiveEventStore } from './live-event-store';

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
		if (gift.repeatEnd || !seenGroupIds.has(gift.groupId)) {
			seenGroupIds.add(gift.groupId);
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
	].sort((a, b) => b.count - a.count);
	return giftCounts;
};

export const useUserGiftCounts = (userId: string) => {
	const userGiftEvents = useLiveEventStore((state) => state.userGiftEvents);
	const giftEvents = userGiftEvents.get(userId);
	return giftEvents ? aggregateGiftCounts(giftEvents) : [];
};
