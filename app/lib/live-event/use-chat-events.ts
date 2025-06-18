import { useLiveEventStore } from './live-event-store';

export const useUserRelatedChatEvents = (userId: string) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const viewerUsername = chatEvents.find(
		(event) => event.userId === userId,
	)?.uniqueId;
	return chatEvents.filter((event) => {
		if (event.type === 'chat' && viewerUsername) {
			return (
				event.comment.includes(`@${viewerUsername}`) || event.userId === userId
			);
		}
		return event.userId === userId;
	});
};

export const useChatEvents = () => {
	return useLiveEventStore((state) => state.chatEvents);
};
