import { useViewerChatEvents } from '~/lib/live-event/use-chat-events';
import { cx } from '~/lib/styles';
import { ChatFeed } from './chat-feed';

export const ViewerChatFeed = ({
	style = {},
	viewerUserId,
	viewerMessageId,
}: {
	style?: React.CSSProperties;
	viewerUserId: string;
	viewerMessageId: string;
}) => {
	const chatEvents = useViewerChatEvents(viewerUserId);
	return (
		<ChatFeed
			style={style}
			messages={chatEvents}
			getMessageStyle={(message) =>
				cx(
					message.id === viewerMessageId && {
						background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 25%, #ec4899 50%, transparent 100%)`,
					},
				)
			}
		/>
	);
};
