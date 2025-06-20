import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import { Avatar, Flex, Image, Space, Typography } from 'antd';

const { Text } = Typography;

// Gift Event Component
export const GiftEventCard: React.FC<{ event: LiveGiftMessage }> = ({
	event,
}) => {
	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '16px',
				background:
					'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 223, 0, 0.15))',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(255, 215, 0, 0.3)',
				boxShadow: '0 8px 32px rgba(255, 215, 0, 0.3)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
				<Avatar src={event.userDetails.profilePictureUrls?.at(-1)} size={36} />
				<Flex style={{ flex: 1 }} vertical justify="space-between">
					<Text
						strong
						style={{
							color: 'rgba(255, 223, 0, 0.95)',
							fontSize: '14px',
							textShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
						}}
					>
						{event.nickname || 'Anonymous'}
					</Text>
					<Text
						style={{
							color: 'rgba(255, 223, 0, 0.7)',
							fontSize: '12px',
							textShadow: '0 0 6px rgba(255, 223, 0, 0.6)',
						}}
					>
						Sent {event.giftName || 'a gift'}
					</Text>
				</Flex>
				<Space size={8} align="end">
					<Image
						preview={false}
						width={40}
						alt={event.giftName}
						src={event.giftPictureUrl}
					/>
					<Space
						size={2}
						align="baseline"
						style={{
							fontStyle: 'italic',
							color: 'rgba(255, 223, 0, 0.95)',
							fontWeight: 'bold',
							textShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
						}}
					>
						<Text
							style={{
								color: 'currentcolor',
								fontSize: '14px',
							}}
						>
							x
						</Text>
						<Text
							style={{
								color: 'currentcolor',
								fontSize: '20px',
								textShadow: '0 0 10px rgba(255, 223, 0, 1)',
							}}
						>
							{event.repeatCount}
						</Text>
					</Space>
				</Space>
			</div>
		</div>
	);
};
