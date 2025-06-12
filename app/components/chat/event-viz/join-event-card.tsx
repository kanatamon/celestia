import type {
	TikTokLiveEvent,
	TikTokLiveEventData,
} from '~/lib/tiktok-live-events';
import type { User } from '../types';
import { Typography } from 'antd';
import { LogIn } from 'lucide-react';

const { Text } = Typography;

export interface JoinEvent {
	type: 'join';
	id: string;
	user: User;
	timestamp: Date;
}

export const imagineJoinEvent = (
	event: TikTokLiveEvent<'member'> & { id: string },
): JoinEvent => {
	return {
		type: 'join',
		id: event.id,
		user: {
			id: event.data.user?.userId || 'unknown',
			name: event.data.user?.nickname || 'New User',
			avatar: event.data.user?.profilePicture?.urls?.at(-1) || '',
		},
		timestamp: new Date(event.data.event?.createTime || Date.now()),
	};
};

export const JoinEventCard: React.FC<{
	event: JoinEvent;
	style?: React.CSSProperties;
}> = ({ event, style = {} }) => {
	return (
		<div
			style={{
				padding: '6px 8px',
				borderRadius: '12px',
				background:
					'linear-gradient(135deg, rgba(59, 130, 246, 0.75), rgba(147, 51, 234, 0))',
				// backdropFilter: 'blur(20px)',
				// border: '1px solid rgba(59, 130, 246, 0.3)',
				boxShadow: '0 4px 24px rgba(59, 130, 246, 0.1)',
				...style,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<div
					style={{
						width: '36px',
						height: '36px',
						borderRadius: '8px',
						background: 'rgba(59, 130, 246, 0.2)',
						backdropFilter: 'blur(20px)',
						border: '1px solid rgba(59, 130, 246, 0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<LogIn
						size={20}
						style={{
							color: '#60a5fa',
						}}
					/>
				</div>
				<Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
					<Text strong style={{ color: '#60a5fa' }}>
						{event.user.name}
					</Text>{' '}
					joined
				</Text>
			</div>
		</div>
	);
};
