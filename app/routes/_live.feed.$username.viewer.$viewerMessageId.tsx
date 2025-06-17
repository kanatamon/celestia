import type { Route } from './+types/_live.feed.$username.viewer.$viewerMessageId';
import { Flex } from 'antd';
import { X } from 'lucide-react';
import invariant from 'tiny-invariant';
import { GlassButton } from '~/components/_ui/glass-button';
import { ViewerChatFeed } from '~/components/viewer-chat-feed';
import { useLiveEventStore } from '~/lib/live-event-store';

export default function ViewerRoute({
	params: { viewerMessageId },
}: Route.ComponentProps) {
	const viewerUserId = useLiveEventStore(
		(state) =>
			state.chatEvents.find((event) => event.id === viewerMessageId)?.userId,
	);
	invariant(
		viewerUserId,
		'Viewer user ID not found for message ID: ' + viewerMessageId,
	);
	return (
		<Flex
			vertical
			justify="start"
			gap={8}
			style={{
				paddingBottom: '24px',
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<ViewerChatFeed style={{ flex: 1 }} viewerUserId={viewerUserId} />
			<div style={{ height: '48px', width: '100%' }} />
		</Flex>
	);
}
