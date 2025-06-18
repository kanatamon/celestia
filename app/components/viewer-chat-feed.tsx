import { useUserRelatedChatEvents } from '~/lib/live-event/use-chat-events';
import { ChatFeed } from './chat-feed';

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
