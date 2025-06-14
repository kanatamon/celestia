import type { LiveChatMessage, LiveGiftMessage } from '~/lib/tiktok-live-store';
import { Avatar, Image, Space, Typography } from 'antd';
import { Highlight } from '~/components/_ui/highlight';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

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
	const giftEvents = useTikTokLiveStore((state) =>
		event.user ? state.userGiftEvents.get(event.user.uniqueId) : [],
	);
	const gifts = giftEvents?.reduce((acc, gift) => {
		const existing = acc.get(gift.giftId);
		const previousCount = existing?.count || 0;
		if (gift.repeatEnd) {
			acc.set(gift.giftId, {
				giftDetails: gift.giftDetails,
				count: previousCount + gift.repeatCount,
			});
		}
		return acc;
	}, new Map<number, { giftDetails: LiveGiftMessage['giftDetails']; count: number }>());

	const { user, comment } = event;
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
				<Avatar src={user?.profilePicture?.urls.at(-1)} size={36} />
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
								color: 'rgba(255, 255, 255, 0.7)', // Reduced opacity for less priority
								textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)', // Subtle shadow for softer appearance
							}}
						>
							{user?.nickname || 'Anonymous'}
						</Text>
						{gifts?.size ? (
							<Space size={12}>
								{Array.from(gifts.values()).map((gift, index) => (
									<Space key={index} size={2} align="center">
										<Image
											src={gift.giftDetails?.giftImage?.giftPictureUrl}
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
						) : null}
					</div>
					<Text
						style={{
							fontSize: '14px',
							lineHeight: '1.5',
							color: 'rgba(255, 255, 255, 0.95)',
							textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
						}}
					>
						{highlightMentions(comment)}
					</Text>
				</div>
			</div>
		</div>
	);
};
