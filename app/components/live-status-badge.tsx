import type { ConnectionStatus } from '~/components/connection-status-badge';
import type { LiveStreamConnection } from '~/lib/live-event/live-event-store';
import { Dropdown, Flex, Typography } from 'antd';
import { LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { GlassButton } from '~/components/_ui/glass-button';
import { GlassModal } from '~/components/_ui/glass-modal';
import { Highlight } from '~/components/_ui/highlight';
import { ConnectionStatusBadge } from '~/components/connection-status-badge';
import { liveEventClient } from '~/lib/live-event/live-event-client';
import { useLiveEventConnection } from '~/lib/live-event/use-live-event-connection';

const { Paragraph } = Typography;

const getLiveStatus = (connection: LiveStreamConnection): ConnectionStatus => {
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

export const LiveStatusBadge: React.FC<{ username: string }> = ({
	username,
}) => {
	const navigate = useNavigate();
	const { connection } = useLiveEventConnection(username);

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
							<GlassButton
								type="text"
								icon={<RefreshCw size={16} />}
								onClick={() => {
									liveEventClient.retry();
								}}
							>
								Reconnect
							</GlassButton>
						),
					},
					{
						key: 'clear-chat',
						label: (
							<GlassButton
								type="text"
								icon={<Trash2 size={16} />}
								onClick={() => {
									GlassModal.confirm({
										title: 'Do you want to clear the chat?',
										icon: <Trash2 size={20} />,
										content: (
											<Flex vertical gap={6}>
												<Paragraph style={{ color: 'currentcolor', margin: 0 }}>
													You'll lose all chat history, likes, and gift data for
													this session. And this action can't be undone.
												</Paragraph>
											</Flex>
										),
										okText: 'Clear Chat',
										onOk: () => {
											navigate(`/feed/${username}`);
											liveEventClient.clearStore();
										},
									});
								}}
							>
								Clear Chat
							</GlassButton>
						),
					},
					{
						key: 'leave-stream',
						label: (
							<GlassButton
								type="text"
								icon={<LogOut size={16} />}
								onClick={() => {
									GlassModal.confirm({
										title: (
											<>
												Leave <Highlight>@{username}</Highlight>'s stream?
											</>
										),
										icon: <Trash2 size={20} />,
										content: (
											<Flex vertical gap={6}>
												<Paragraph style={{ color: 'currentcolor', margin: 0 }}>
													You'll lose all chat history, likes, and gift data for
													this session. The live stream will stop and this
													action can't be undone.
												</Paragraph>
												<Paragraph style={{ color: 'currentcolor', margin: 0 }}>
													You can always reconnect to{' '}
													<Highlight>@{username}</Highlight> later to start
													fresh.
												</Paragraph>
											</Flex>
										),
										okText: 'Leave Stream',
										onOk: () => {
											liveEventClient.forceDisconnect();
											liveEventClient.clearStore();
											navigate('/');
										},
									});
								}}
							>
								Leave Stream
							</GlassButton>
						),
					},
				],
			}}
		>
			{/* This <div> wrapper is required, but don't know why? 😅 */}
			<div>
				<ConnectionStatusBadge status={status} />
			</div>
		</Dropdown>
	);
};
