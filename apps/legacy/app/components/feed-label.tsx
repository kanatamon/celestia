import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import type { ChatEventFilter } from '~/lib/live-event/use-chat-events';
import { Badge, Image } from 'antd';
import { useChatEvents } from '~/lib/live-event/use-chat-events';

const calculateGiftsCountAfterPinnedMessage = (
	pinnedMessageId: string | null | undefined,
	events: LiveFeedMessage[],
) => {
	if (!pinnedMessageId) {
		return events.filter((event) => event.type === 'gift').length;
	}

	const pinnedMessageIndex = events.findIndex(
		(event) => event.id === pinnedMessageId,
	);

	if (pinnedMessageIndex === -1) {
		return 0;
	}

	const eventsAfterPinnedMessage = events.slice(pinnedMessageIndex + 1);
	return eventsAfterPinnedMessage.filter((event) => event.type === 'gift')
		.length;
};

export const FeedLabel: React.FC<{
	label?: string | undefined | null;
	pinnedMessageId?: string | null | undefined;
	filter?: ChatEventFilter;
}> = ({ label, filter, pinnedMessageId }) => {
	const events = useChatEvents({
		filter: {
			...filter,
			reserve: (e) => {
				return e.id === pinnedMessageId || Boolean(filter?.reserve?.(e));
			},
		},
	});

	const remainingGiftsCount = calculateGiftsCountAfterPinnedMessage(
		pinnedMessageId,
		events,
	);

	if (label) {
		return (
			<Badge count={remainingGiftsCount} hidden={remainingGiftsCount === 0}>
				{label}
			</Badge>
		);
	}

	// Try finding recent gift event to use its picture
	const giftEvent = events.findLast((e) => {
		return e.type === 'gift';
	});
	if (giftEvent?.type === 'gift') {
		return (
			<Badge count={remainingGiftsCount} hidden={remainingGiftsCount === 0}>
				<div
					style={{
						position: 'relative',
						width: 24,
						height: 22,
						content: '',
					}}
				>
					<Image
						style={{
							position: 'absolute',
							inset: 0,
							transform: 'translateX(-6px) translateY(-55%)',
						}}
						preview={false}
						width={36}
						alt={giftEvent?.giftName}
						src={giftEvent?.giftPictureUrl}
					/>
				</div>
			</Badge>
		);
	}

	const displayLabel = filter?.diamondCountMin || filter?.userPaidDiamondMin;
	return (
		<Badge count={remainingGiftsCount} hidden={remainingGiftsCount === 0}>
			{displayLabel ? `${displayLabel}+` : '💎'}
		</Badge>
	);
};
