import invariant from 'tiny-invariant';
import { useMessageOwner } from '~/lib/live-event/use-message-owner';
import { ViewerChatFeed } from './viewer-chat-feed';

export const MessageViewer = ({ messageId }: { messageId: string }) => {
	const userId = useMessageOwner(messageId)?.userId;
	invariant(
		userId,
		'The message you are trying to view does not exist or has been deleted.',
	);
	return (
		<ViewerChatFeed
			style={{ flex: 1 }}
			viewerUserId={userId}
			viewerMessageId={messageId}
		/>
	);
};
