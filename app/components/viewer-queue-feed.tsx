import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import { Flex } from 'antd';
import { X } from 'lucide-react';
import { useGiftQueueStore } from '~/lib/live-event/gift-queue-store';
import { GlassButton } from './_ui/glass-button';
import { ViewerQueueCard } from './event-viz/viewer-queue-card';

export const ViewerQueueFeed = ({
	style = {},
	pinnedMessageId,
	onPinnedMessageChange,
}: {
	style?: React.CSSProperties;
	pinnedMessageId?: string | null | undefined;
	onPinnedMessageChange?: (message: LiveFeedMessage | null | undefined) => void;
}) => {
	const giftQueueEvents = useGiftQueueStore((state) => state.items);
	const moveToSettling = useGiftQueueStore((state) => state.moveToSettling);
	const cancelSettling = useGiftQueueStore((state) => state.cancelSettling);
	const moveToReverting = useGiftQueueStore((state) => state.moveToReverting);
	const cancelReverting = useGiftQueueStore((state) => state.cancelReverting);

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
				// gap={4}
			>
				{giftQueueEvents.map((event) => (
					<div
						style={{
							width: '100%',
							position:
								pinnedMessageId === event.gift.event.msgId
									? 'sticky'
									: 'relative',
							top:
								pinnedMessageId === event.gift.event.msgId ? '0px' : undefined,
							zIndex: pinnedMessageId === event.gift.event.msgId ? 10 : 'auto',
						}}
						key={event.id}
					>
						<Flex
							justify="start"
							style={{
								width: '100%',
								position: 'relative',
							}}
						>
							{pinnedMessageId === event.gift.event.msgId && (
								<div
									style={{
										position: 'absolute',
										inset: 0,
										width: '100%',
										height: '100%',
										background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 25%, #ec4899 50%, transparent 100%)`,
										isolation: 'isolate',
									}}
								/>
							)}
							<ViewerQueueCard
								key={event.id}
								event={event}
								onPositionClick={() => {
									if (event.state === 'waiting') {
										moveToSettling(event.id);
									} else if (event.state === 'settling') {
										cancelSettling(event.id);
									} else if (event.state === 'completed') {
										moveToReverting(event.id);
									} else if (event.state === 'reverting') {
										cancelReverting(event.id);
									}
									console.warn(
										`Unhandled state transition for ${event.id} in state ${event.state}`,
									);
								}}
								onBodyClick={() => {
									onPinnedMessageChange?.(event.gift);
								}}
							/>
							{pinnedMessageId === event.gift.event.msgId && (
								<GlassButton
									type="text"
									style={{
										position: 'absolute',
										top: '8px',
										right: '8px',
										cursor: 'pointer',
										isolation: 'isolate',
									}}
									icon={<X size={20} />}
									onClick={(e) => {
										e.stopPropagation();
										onPinnedMessageChange?.(null);
									}}
								/>
							)}
						</Flex>
					</div>
				))}
			</Flex>
		</div>
	);
};
