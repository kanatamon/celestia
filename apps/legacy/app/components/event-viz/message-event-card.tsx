import type { LiveChatMessage } from '~/lib/live-event/live-event-store';
import { Avatar, Flex, Image, Space, Typography } from 'antd';
import { Highlight } from '~/components/_ui/highlight';
import { useUserGiftCounts } from '~/lib/live-event/use-gift-counts';
import { EventTimestamp } from '../event-timestamp';

const { Text, Paragraph } = Typography;

const MAX_GIFTS_DISPLAY = 2;

// Helper function to highlight mentions
const highlightMentions = (text: string) => {
	const mentionRegex = /@([^\s]+)/g;
	const parts = text.split(mentionRegex);

	return parts.map((part, index) => {
		if (index % 2 === 1) {
			return <Highlight key={index}>@{part}</Highlight>;
		}
		return part;
	});
};

const MessageBubble: React.FC<{
	text: string;
	style?: React.CSSProperties;
}> = ({ text, style = {} }) => {
	return (
		<div
			style={{
				position: 'relative',
				width: 'fit-content',
				...style,
			}}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 500 500"
				width={16}
				height={16}
				style={{
					position: 'absolute',
					top: '0px',
					left: '-6px',
				}}
			>
				<path
					fill="rgba(0, 0, 0, 0.5)"
					d="M 7.345 20.273 C 262.053 61.815 213.415 428.641 213.031 501.451 L 499.161 502.063 C 501.472 232.37 386.075 -28.462 7.345 20.273 Z"
				/>
			</svg>
			<Paragraph
				style={{
					fontSize: '14px',
					lineHeight: '1.5',
					color: 'rgba(255, 255, 255, 0.9)',
					textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
					padding: '6px 8px',
					borderRadius: '12px',
					background: 'rgba(0, 0, 0, 0.5)',
					backdropFilter: 'blur(5px)',
					boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
				}}
			>
				{highlightMentions(text)}
			</Paragraph>
		</div>
	);
};

export const MessageEventCard: React.FC<{ event: LiveChatMessage }> = ({
	event,
}) => {
	const { heartMeGift, paidGifts } = useUserGiftCounts(event.userId);

	if (!event.comment) {
		console.warn('MessageEventCard: No comment found in event', event);
	}
	return (
		<Flex
			align="start"
			gap={8}
			style={{
				isolation: 'isolate',
			}}
		>
			<div
				style={{
					position: 'relative',
				}}
			>
				<Avatar src={event.userDetails.profilePictureUrls?.at(-1)} size={36} />
				{heartMeGift && (
					<div
						style={{
							position: 'absolute',
							top: '-4px',
							right: '-4px',
						}}
					>
						<Image
							preview={false}
							src={heartMeGift.giftDetails.giftPictureUrl}
							width={24}
							alt="Follower Gift"
						/>
					</div>
				)}
			</div>
			<Flex vertical>
				<Space>
					<Text
						strong
						style={{
							fontSize: '14px',
							color: 'rgba(255, 255, 255, 0.6)', // Reduced opacity for less priority
							textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)', // Subtle shadow for softer appearance
						}}
					>
						<span style={{ marginRight: 6 }}>
							{event.nickname || 'Anonymous'}
						</span>
						{paidGifts[0] && (
							<>
								{paidGifts.slice(0, MAX_GIFTS_DISPLAY).map((gift, index) => (
									<span
										key={index}
										style={{
											marginRight: 6,
											whiteSpace: 'nowrap',
										}}
									>
										<Image
											preview={false}
											src={gift.giftDetails.giftPictureUrl}
											width={18}
											alt={gift.giftDetails?.giftName}
										/>
										<Space
											size={2}
											align="baseline"
											style={{
												fontStyle: 'italic',
												color: 'rgba(255, 255, 255, 0.95)',
												fontWeight: 'bold',
											}}
										>
											<Text
												style={{
													color: 'currentcolor',
													fontSize: '10px',
												}}
											>
												x
											</Text>
											<Text
												style={{
													color: 'currentcolor',
													fontSize: '14px',
												}}
											>
												{gift.count}
											</Text>
										</Space>
									</span>
								))}
								{paidGifts.length > MAX_GIFTS_DISPLAY && (
									<Text
										style={{
											color: 'rgba(255, 255, 255, 0.6)',
											fontSize: '12px',
											fontStyle: 'italic',
											whiteSpace: 'nowrap',
										}}
									>
										+{paidGifts.length - MAX_GIFTS_DISPLAY} more
									</Text>
								)}
							</>
						)}
					</Text>
				</Space>
				<Flex align="end" gap={4}>
					<MessageBubble text={event.comment} />
					<EventTimestamp event={event} />
				</Flex>
			</Flex>
		</Flex>
	);
};
