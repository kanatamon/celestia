import type { LiveFeedMessage } from '~/lib/live-event-store';
import { useLiveEventStore } from '~/lib/live-event-store';
import { cx } from '~/lib/styles';
import { ChatFeed } from './chat-feed';

const useUserRelatedChatEvents = (userId: string) => {
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

export const ViewerChatFeed = ({
	style = {},
	viewerUserId,
}: {
	style?: React.CSSProperties;
	viewerUserId: string;
}) => {
	const chatEvents = useUserRelatedChatEvents(viewerUserId);
	return <ChatFeed style={style} messages={chatEvents} />;
};
