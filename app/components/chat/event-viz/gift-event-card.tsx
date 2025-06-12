import type { Gift, User } from '../types';
import { Avatar, Flex, Image, Space, Typography } from 'antd';

const { Text, Title } = Typography;

export interface GiftEvent {
	type: 'gift';
	id: string;
	user: User;
	gift: Gift;
	timestamp: Date;
}

// Gift Event Component
export const GiftEventCard: React.FC<{ event: GiftEvent }> = ({ event }) => {
	const { user, gift } = event;

	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '16px',
				background:
					'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(245, 101, 101, 0.15))',
				// background:
				// 	'linear-gradient(135deg, rgba(251, 146, 60, 0.75), rgba(245, 101, 101, 0.01))',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(251, 146, 60, 0.3)',
				boxShadow: '0 8px 32px rgba(251, 146, 60, 0.1)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
				<Avatar
					src={user.avatar}
					size={36}
					// style={{ border: '2px solid rgba(255, 255, 255, 0.1)' }}
				/>
				<Flex style={{ flex: 1 }} vertical justify="space-between">
					<Text
						strong
						style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: '14px' }}
					>
						{user.name}
					</Text>
					<Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
						Sent {gift.name}
					</Text>
				</Flex>
				<Space size={8} align="end">
					<Image width={40} alt={gift.name} src={gift.image} />
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
								fontSize: '14px',
							}}
						>
							x
						</Text>
						<Text
							style={{
								color: 'currentcolor',
								fontSize: '20px',
							}}
						>
							{gift.repeat}
						</Text>
					</Space>
				</Space>
			</div>
		</div>
	);
};
