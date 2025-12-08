import type { LiveFeedMessage } from './live-event-store';
import { useLiveEventStore } from './live-event-store';

export type ChatEventFilter = {
	reserve?: (event: LiveFeedMessage) => boolean;
	userPaidDiamondMin?: number;
	userPaidDiamondMax?: number;
	diamondCountMin?: number;
	diamondCountMax?: number;
};

export const useViewerChatEvents = (viewerUserId: string) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const viewerName = chatEvents.find(
		(event) => event.userId === viewerUserId,
	)?.nickname;
	return chatEvents.filter((event) => {
		if (event.type === 'chat' && viewerName && event.comment) {
			return (
				event.comment.includes(`@${viewerName}`) ||
				event.userId === viewerUserId
			);
		}
		return event.userId === viewerUserId;
	});
};

export const useChatEvents = (options?: { filter?: ChatEventFilter }) => {
	const getUserHighestPaidDiamondCount = useLiveEventStore(
		(state) => state.getUserHighestPaidDiamondCount,
	);
	const events = useLiveEventStore((state) => state.chatEvents);

	if (options?.filter) {
		const userPaidDiamondMin = options.filter?.userPaidDiamondMin || 0;
		const userPaidDiamondMax =
			options.filter?.userPaidDiamondMax || Number.MAX_SAFE_INTEGER;
		const diamondCountMin = options.filter?.diamondCountMin || 0;
		const diamondCountMax =
			options.filter?.diamondCountMax || Number.MAX_SAFE_INTEGER;

		return events.filter((e) => {
			if (options.filter?.reserve && options.filter.reserve(e)) return true;

			const userDiamondCount = getUserHighestPaidDiamondCount(e.userId);
			if (userDiamondCount < userPaidDiamondMin) return false;
			if (userDiamondCount >= userPaidDiamondMax) return false;

			if (e.type === 'gift') {
				if (e.diamondCount < diamondCountMin) return false;
				if (e.diamondCount >= diamondCountMax) return false;
			}

			return true;
		});
	}

	return events;
};
