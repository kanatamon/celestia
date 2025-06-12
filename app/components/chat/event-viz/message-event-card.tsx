import type { GiftCount, User } from '../types';
import { Avatar, Image, Space, Typography } from 'antd';
import { Highlight } from '~/components/_ui/highlight';

const { Text } = Typography;

export interface MessageEvent {
	type: 'message';
	id: string;
	user: User;
	message: string;
	timestamp: Date;
	gifts: GiftCount[];
}

// Helper function to highlight mentions
const highlightMentions = (text: string) => {
	const mentionRegex = /@(\w+)/g;
	const parts = text.split(mentionRegex);

	return parts.map((part, index) => {
		if (index % 2 === 1) {
			return (
				<Highlight
					key={index}
					style={{
						color: '#a78bfa',
						fontWeight: 'bold',
						textShadow: '0 0 8px rgba(167, 139, 250, 0.3)',
					}}
				>
					@{part}
				</Highlight>
			);
		}
		return part;
	});
};

export const MessageEventCard: React.FC<{ event: MessageEvent }> = ({
	event,
}) => {
	const { user, message, gifts } = event;

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
				<Avatar src={user.avatar} size={36} />
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
								color: 'rgba(255, 255, 255, 0.95)',
								fontSize: '14px',
								textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
							}}
						>
							{user.name}
						</Text>
						{gifts.length > 0 && (
							<Space size={12}>
								{gifts.map((gift, index) => (
									<Space key={index} size={2} align="center">
										<Image src={gift.image} width={18} alt={gift.name} />
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
									// <Badge
									// 	key={index}
									// 	count={gift.count}
									// 	size="small"
									// 	color="gold"
									// >
									// 	<Image src={gift.image} width={18} alt={gift.name} />
									// </Badge>
								))}
							</Space>
						)}
					</div>
					<Text
						style={{
							fontSize: '14px',
							lineHeight: '1.5',
							color: 'rgba(255, 255, 255, 0.85)',
							textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
						}}
					>
						{highlightMentions(message)}
					</Text>
				</div>
			</div>
		</div>
	);
};
