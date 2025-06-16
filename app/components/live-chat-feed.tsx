import type { LiveFeedMessage } from '~/lib/live-event-store';
import { Flex } from 'antd';
import { ArrowDownToLine } from 'lucide-react';
import { GlassButton } from '~/components/_ui/glass-button';
// import { FollowerEventCard } from '~/components/event-viz/follow-event-card';
import { GiftEventCard } from '~/components/event-viz/gift-event-card';
import { MessageEventCard } from '~/components/event-viz/message-event-card';
// import { ShareEventComponent } from '~/components/event-viz/share-event-card';
import { useLiveEventStore } from '~/lib/live-event-store';
import { useAutoScroll } from '~/lib/use-auto-scroll';
import { AddEventTimestamp } from './add-event-timestamp';

export const LiveChatFeed = ({
	style = {},
}: {
	style?: React.CSSProperties;
}) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll({
		dependencies: [chatEvents.at(-1)?.id], // Trigger on new messages
		threshold: 100, // 100px from bottom counts as "at bottom"
		behavior: 'smooth',
	});

	const renderEvent = (event: LiveFeedMessage) => {
		switch (event.type) {
			case 'chat':
				return <MessageEventCard key={event.id} event={event} />;
			// case 'follow':
			// 	return <FollowerEventCard key={event.id} event={event} />;
			// case 'share':
			// 	return <ShareEventComponent key={event.id} event={event} />;
			case 'gift':
				return <GiftEventCard key={event.id} event={event} />;
			default:
				return null;
		}
	};

	return (
		<div
			style={{
				height: '100%',
				position: 'relative',
				maxHeight: '100%',
				overflow: 'hidden',
				...style,
			}}
		>
			<Flex
				ref={scrollRef}
				style={{
					paddingRight: '8px',
					position: 'relative',
					scrollbarWidth: 'thin',
					scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
					height: '100%',
					maxHeight: '100%',
					overflowY: 'auto',
				}}
				vertical
				align="start"
				gap={8}
			>
				{chatEvents.map((event) => (
					<AddEventTimestamp key={event.id} event={event}>
						{renderEvent(event)}
					</AddEventTimestamp>
				))}
			</Flex>

			{/* Show "scroll to bottom" button when not at bottom */}
			{!isAtBottom && chatEvents[0] && (
				<div
					style={{
						zIndex: 10,
						position: 'absolute',
						bottom: '0',
						right: '0',
						width: '100%',
						height: '160px',
						background:
							'linear-gradient(to top, rgba(236, 72, 153, 0.5) 0%, rgba(167, 139, 250, 0.2) 50%, rgba(255, 255, 255, 0) 100%)',
					}}
				>
					<GlassButton
						onClick={scrollToBottom}
						style={{
							position: 'absolute',
							bottom: '64px',
							left: '50%',
							transform: 'translateX(-50%)',
						}}
						shape="round"
						icon={<ArrowDownToLine size={16} />}
					>
						New messages
					</GlassButton>
				</div>
			)}
		</div>
	);
};
