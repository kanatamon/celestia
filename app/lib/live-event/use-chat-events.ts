import { useLiveEventStore } from './live-event-store';

export const useUserRelatedChatEvents = (userId: string) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const viewerName = chatEvents.find(
		(event) => event.userId === userId,
	)?.nickname;
	return chatEvents.filter((event) => {
		if (event.type === 'chat' && viewerName) {
			return (
				event.comment.includes(`@${viewerName}`) || event.userId === userId
			);
		}
		return event.userId === userId;
	});
};

export const useChatEvents = () => {
	return useLiveEventStore((state) => state.chatEvents);
};
