import type { ConnectionStatus } from '~/lib/tiktok-live-events';
import type { Route } from './+types/_live';
import { Flex, Space } from 'antd';
import { Outlet } from 'react-router';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { Highlight } from '~/components/_ui/highlight';
import { LiveConnectionAlert } from '~/components/live-connection-alert';
import { LiveLikeCounter } from '~/components/live-like-counter';
import { LiveStatusBadge } from '~/components/live-status-badge';
import { LiveViewerCounter } from '~/components/live-viewer-counter';
import { useLiveEventConnection } from '~/lib/use-live-event-connection';

export function clientLoader({ request }: Route.ClientLoaderArgs) {
	const url = new URL(request.url);
	const username = url.searchParams.get('username');
	if (!username) {
		throw new Error(
			'Username is required in the search params. Example: ?username=your_username',
		);
	}
	return {
		username: username.replace('@', '').trim(),
	};
}

export const HydrateFallback = () => {
	return (
		<div
			style={{
				backgroundImage: 'url(/background_starry_sky.png)',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				width: '100%',
				height: '100%',
				maxWidth: '100vw',
				overflowX: 'hidden',
			}}
		>
			<CenteredMessageOverlay>Validating...</CenteredMessageOverlay>
		</div>
	);
};

export default function TikTokLiveGuardLayout({
	loaderData: { username },
}: Route.ComponentProps) {
	const { connection } = useLiveEventConnection(username);
	return (
		<div
			style={{
				backgroundImage: 'url(/background_starry_sky.png)',
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
