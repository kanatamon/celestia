import type { User } from '../types';
import { Avatar, Typography } from 'antd';

const { Text } = Typography;

export interface ShareEvent {
	type: 'share';
	id: string;
	user: User;
	timestamp: Date;
}

export const ShareEventComponent: React.FC<{ event: ShareEvent }> = ({
	event,
}) => {
	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '12px',
				background:
					'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.15))',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(168, 85, 247, 0.3)',
				boxShadow: '0 4px 24px rgba(168, 85, 247, 0.1)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<Avatar src={event.user.avatar} size={36} />
				<Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
					<Text
						strong
						style={{
							color: 'rgb(119, 88, 211)',
						}}
					>
						{event.user.name}
					</Text>{' '}
					shared this live
				</Text>
			</div>
		</div>
	);
};
