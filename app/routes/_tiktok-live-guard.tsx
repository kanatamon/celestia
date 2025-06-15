import type { Route } from './+types/_tiktok-live-guard';
import { Flex, Space } from 'antd';
import { Outlet } from 'react-router';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { Highlight } from '~/components/_ui/highlight';
import { TikTokLiveLikeCounter } from '~/components/chat/tiktok-live-like-counter';
import { TikTokLiveStatusBadge } from '~/components/chat/tiktok-live-status-badge';
import { TikTokLiveViewerCounter } from '~/components/chat/tiktok-live-viewer-counter';
import { TikTokLiveConnectionAlert } from '~/components/tiktok-live-connection-alert';
import { useTikTokLiveConnection } from '~/lib/use-tiktok-live-connection';

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
	const { connection } = useTikTokLiveConnection(username);
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
			{['connecting', 'tiktok:authenticating'].includes(connection.status) ? (
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
						justify="end"
						style={{
							padding: '16px',
						}}
					>
						<Space align="center">
							<TikTokLiveLikeCounter />
							<TikTokLiveViewerCounter />
							<TikTokLiveStatusBadge username={username} />
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
			<TikTokLiveConnectionAlert username={username} />
		</div>
	);
}
