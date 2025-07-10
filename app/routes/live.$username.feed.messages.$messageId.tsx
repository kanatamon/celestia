import type { Route } from './+types/live.$username.feed.messages.$messageId';
import { Flex } from 'antd';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { MessageViewer } from '~/components/message-viewer';
import { ClientOnly } from '~/lib/client-only';

export default function MessageRoute({
	params: { messageId: viewerMessageId },
}: Route.ComponentProps) {
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
			<ClientOnly>
				<MessageViewer messageId={viewerMessageId} />
			</ClientOnly>
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
