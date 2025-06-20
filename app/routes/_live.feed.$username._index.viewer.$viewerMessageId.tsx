import type { Route } from './+types/_live.feed.$username._index.viewer.$viewerMessageId';
import { Flex } from 'antd';
import invariant from 'tiny-invariant';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { ViewerChatFeed } from '~/components/viewer-chat-feed';
import { useMessageOwner } from '~/lib/live-event/use-message-owner';

export default function ViewerRoute({
	params: { viewerMessageId },
}: Route.ComponentProps) {
	const viewerUserId = useMessageOwner(viewerMessageId)?.userId;
	invariant(
		viewerUserId,
		'The message you are trying to view does not exist or has been deleted.',
	);
	return (
		<Flex
			vertical
			justify="start"
			gap={8}
			style={{
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<ViewerChatFeed
				style={{ flex: 1 }}
				viewerUserId={viewerUserId}
				viewerMessageId={viewerMessageId}
			/>
		</Flex>
	);
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
	let message = 'An unexpected error occurred.';
	if (error instanceof Error) {
		message = error.message;
	}
	return <CenteredMessageOverlay>{message}</CenteredMessageOverlay>;
};
