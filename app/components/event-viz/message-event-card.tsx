import type { LiveChatMessage } from '~/lib/live-event-store';
import { Avatar, Image, Space, Typography } from 'antd';
import { Highlight } from '~/components/_ui/highlight';
import { useLiveEventStore } from '~/lib/live-event-store';
import { aggregateGiftCounts } from '~/lib/utils';

const { Text } = Typography;

// Helper function to highlight mentions
const highlightMentions = (text: string) => {
	const mentionRegex = /@(\w+)/g;
	const parts = text.split(mentionRegex);

	return parts.map((part, index) => {
		if (index % 2 === 1) {
			return <Highlight key={index}>@{part}</Highlight>;
		}
		return part;
	});
};

export const MessageEventCard: React.FC<{ event: LiveChatMessage }> = ({
	event,
}) => {
	const giftEvents = useLiveEventStore((state) =>
		state.userGiftEvents.get(event.uniqueId),
	);
	const gifts = giftEvents ? aggregateGiftCounts(giftEvents) : [];

	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '16px',
				background: 'rgba(0, 0, 0, 0.5)',
				backdropFilter: 'blur(5px)',
				border: '1px solid rgba(255, 255, 255, 0.15)',
				boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
				transition: 'all 0.3s ease',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
				<Avatar src={event.userDetails.profilePictureUrls?.at(-1)} size={36} />
				<div style={{ flex: 1 }}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
						}}
					>
						<Text
							strong
							style={{
								fontSize: '14px',
								color: 'rgba(255, 255, 255, 0.6)', // Reduced opacity for less priority
								textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)', // Subtle shadow for softer appearance
							}}
						>
							{event.nickname || 'Anonymous'}
						</Text>
						{gifts[0] && (
							<Space size={6}>
								{gifts.map((gift, index) => (
									<Space key={index} size={2} align="center">
										<Image
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
									</Space>
								))}
							</Space>
						)}
					</div>
					<Text
						style={{
							fontSize: '14px',
							lineHeight: '1.5',
							color: 'rgba(255, 255, 255, 0.9)',
							textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
						}}
					>
						{highlightMentions(event.comment)}
					</Text>
				</div>
			</div>
		</div>
	);
};
