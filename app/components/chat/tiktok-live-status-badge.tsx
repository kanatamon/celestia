import type { LiveStatus } from '~/components/_ui/live-status-badge';
import type { LiveStreamConnection } from '~/lib/tiktok-live-store';
import { Dropdown } from 'antd';
import { LogOut, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { LiveStatusBadge } from '~/components/_ui/live-status-badge';
import { tikTokLiveClient } from '~/lib/tiktok-live-client';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { Button } from '../_ui/button';
import { Highlight } from '../_ui/highlight';

const getLiveStatus = (connection: LiveStreamConnection): LiveStatus => {
	if (connection.status === 'tiktok:live_active') {
		return 'live';
	}
	if (connection.status === 'tiktok:room_found') {
		return 'starting';
	}
	if (connection.status === 'tiktok:authenticating') {
		return 'starting';
	}
	if (connection.status === 'connecting') {
		return 'connecting';
	}
	if (connection.status === 'reconnecting') {
		return 'reconnecting';
	}
	if (connection.status === 'tiktok:stream_ended') {
		return 'ended';
	}
	return 'disconnected';
};

export const TikTokLiveStatusBadge: React.FC<{ username: string }> = ({
	username,
}) => {
	const connection = useTikTokLiveStore((state) => state.connection);
	const status = getLiveStatus(connection);
	return (
		<Dropdown
			trigger={['click', 'hover']}
			menu={{
				style: {
					background: `rgba(255, 255, 255, 0.1)`,
					backdropFilter: 'blur(10px)',
					borderRadius: '8px',
					boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
				},
				items: [
					{
						key: 'current-username',
						label: (
							<Highlight style={{ padding: '6px 12px' }}>@{username}</Highlight>
						),
					},
					{
						key: 'reconnect',
						label: (
							<Button
								type="text"
								icon={
									<RefreshCw
										size={16}
										onClick={() => {
											tikTokLiveClient.retry();
										}}
									/>
								}
							>
								Reconnect
							</Button>
						),
					},
					{
						key: 'exit',
						label: (
							<Link to="/">
								<Button type="text" icon={<LogOut size={16} />}>
									Exit
								</Button>
							</Link>
						),
					},
				],
			}}
		>
			{/* This <div> wrapper is required, but don't know why? 😅 */}
			<div>
				<LiveStatusBadge status={status} />
			</div>
		</Dropdown>
	);
};
