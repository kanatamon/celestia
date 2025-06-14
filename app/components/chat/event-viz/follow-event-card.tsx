import type { LiveFollowMessage } from '~/lib/tiktok-live-store';
import { Avatar, Typography } from 'antd';

const { Text } = Typography;

export const FollowerEventCard: React.FC<{ event: LiveFollowMessage }> = ({
	event,
}) => {
	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '12px',
				background:
					'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.15))',
				backdropFilter: 'blur(20px)',
				border: '1px solid rgba(34, 197, 94, 0.3)',
				boxShadow: '0 4px 24px rgba(34, 197, 94, 0.1)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<Avatar src={event.user?.profilePicture?.urls.at(-1)} size={36} />
				<Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
					<Text strong style={{ color: '#60efff' }}>
						{event.user?.nickname || 'Anonymous'}
					</Text>{' '}
					started following
				</Text>
			</div>
		</div>
	);
};
