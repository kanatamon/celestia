import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import { Flex } from 'antd';
import { ArrowDownToLine } from 'lucide-react';
import { GlassButton } from '~/components/_ui/glass-button';
import { GiftEventCard } from '~/components/event-viz/gift-event-card';
import { MessageEventCard } from '~/components/event-viz/message-event-card';
import { useAutoScroll } from '~/lib/use-auto-scroll';
import { AddEventTimestamp } from './add-event-timestamp';

export const ChatFeed: React.FC<{
	messages: LiveFeedMessage[];
	style?: React.CSSProperties;
	showScrollButton?: boolean;
	autoScroll?: boolean;
	renderMessage?: (
		message: LiveFeedMessage,
		defaultRender: React.ReactNode,
	) => React.ReactNode;
	onMessageClick?: (message: LiveFeedMessage, element: HTMLElement) => void;
	getMessageStyle?: (message: LiveFeedMessage) => React.CSSProperties;
	getMessageClassName?: (message: LiveFeedMessage) => string;
}> = ({
	messages: events,
	style = {},
	showScrollButton = true,
	autoScroll = true,
	renderMessage: customRenderMessage,
	onMessageClick,
	getMessageStyle,
	getMessageClassName,
}) => {
	const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll({
		dependencies: autoScroll ? [events.at(-1)?.id] : [],
		threshold: 100,
		behavior: 'smooth',
	});

	const renderMessage = (event: LiveFeedMessage) => {
		const defaultRender = (() => {
			switch (event.type) {
				case 'chat':
					return <MessageEventCard key={event.id} event={event} />;
				case 'gift':
					return <GiftEventCard key={event.id} event={event} />;
				default:
					return null;
			}
		})();

		return customRenderMessage
			? customRenderMessage(event, defaultRender)
			: defaultRender;
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
				{events.map((event) => (
					<Flex
						key={event.id}
						justify="start"
						style={{
							width: '100%',
							...getMessageStyle?.(event),
						}}
						className={getMessageClassName?.(event)}
						onClick={(mouseEvent) => {
							onMessageClick?.(event, mouseEvent.currentTarget);
						}}
					>
						<AddEventTimestamp event={event}>
							{renderMessage(event)}
						</AddEventTimestamp>
					</Flex>
				))}
			</Flex>

			{/* Scroll to bottom button */}
			{showScrollButton && !isAtBottom && events[0] && (
				<div
					style={{
						zIndex: 10,
						position: 'absolute',
						bottom: '0',
						right: '0',
						width: '100%',
						height: '160px',
						marginRight: '8px',
						background:
							'linear-gradient(to top, rgba(37, 99, 235, 0.5) 0%, rgba(59, 130, 246, 0.2) 50%, rgba(255, 255, 255, 0) 100%)',
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
