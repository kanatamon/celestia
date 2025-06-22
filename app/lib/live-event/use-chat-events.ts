import { useLiveEventStore } from './live-event-store';

export const useViewerChatEvents = (viewerUserId: string) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const viewerName = chatEvents.find(
		(event) => event.userId === viewerUserId,
	)?.nickname;
	return chatEvents.filter((event) => {
		if (event.type === 'chat' && viewerName) {
			return (
				event.comment.includes(`@${viewerName}`) ||
				event.userId === viewerUserId
			);
		}
		return event.userId === viewerUserId;
	});
};

export const useChatEvents = () => {
	return useLiveEventStore((state) => state.chatEvents);
};
