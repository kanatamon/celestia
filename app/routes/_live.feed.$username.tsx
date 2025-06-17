import type { ConnectionStatus } from '~/lib/tiktok-live-events';
import type { Route } from './+types/_live.feed.$username';
import { Flex, Space } from 'antd';
import { Outlet } from 'react-router';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { Highlight } from '~/components/_ui/highlight';
import { LiveConnectionAlert } from '~/components/live-connection-alert';
import { LiveLikeCounter } from '~/components/live-like-counter';
import { LiveStatusBadge } from '~/components/live-status-badge';
import { LiveViewerCounter } from '~/components/live-viewer-counter';
import { useLiveEventConnection } from '~/lib/use-live-event-connection';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Live Chat' },
		{
			name: 'description',
			content:
				'View and interact with live stream chat messages in real-time. Follow the conversation and see live reactions from viewers.',
		},
	];
}

export default function LiveLayout({
	params: { username },
}: Route.ComponentProps) {
	const { connection } = useLiveEventConnection(username);
	return (
		<div
			style={{
				backgroundImage: 'url(/background_starry_sky.webp)',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				width: '100%',
				height: '100%',
			}}
		>
			{(['connecting', 'tiktok:authenticating'] as ConnectionStatus[]).includes(
				connection.status,
			) ? (
				<CenteredMessageOverlay>
					Connecting to <Highlight>@{username}...</Highlight>
				</CenteredMessageOverlay>
			) : (
				<Flex
					vertical
					style={{
						maxWidth: '1024px',
						width: '100%',
						height: '100%',
						margin: '0 auto',
						position: 'relative',
					}}
				>
					<Flex
						gap={8}
						style={{
							padding: '16px',
						}}
					>
						<Space
							align="center"
							style={{
								marginLeft: 'auto',
							}}
						>
							<LiveLikeCounter />
							<LiveViewerCounter />
							<LiveStatusBadge username={username} />
						</Space>
					</Flex>
					<div
						style={{
							flex: 1,
							overflow: 'hidden',
						}}
					>
						<Outlet />
					</div>
				</Flex>
			)}
			<LiveConnectionAlert username={username} />
		</div>
	);
}
