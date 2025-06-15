import type { LiveGiftMessage } from '~/lib/tiktok-live-store';

export const aggregateGiftCounts = (events: LiveGiftMessage[]) => {
	const seenGroupIds = new Set<LiveGiftMessage['groupId']>();
	type Gifts = Map<
		LiveGiftMessage['giftId'],
		{
			id: LiveGiftMessage['giftId'];
			giftDetails: LiveGiftMessage['giftDetails'];
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
				giftDetails: gift.giftDetails,
				count: previousCount + gift.repeatCount,
			});
		}
		return acc;
	}, new Map());
	return Array.from(gifts.values());
};
