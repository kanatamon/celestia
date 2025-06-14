import type { Route } from './+types/_tiktok-live-guard.live-feed';
import { Flex, Space, Typography } from 'antd';
import invariant from 'tiny-invariant';
import { NewUserJoinEventCard } from '~/components/chat/new-user-join-even-card';
import { TikTokLiveChatFeed } from '~/components/chat/tiktok-live-chat-feed';
import { TikTokLiveInteractionBubbleSpawnPoint } from '~/components/chat/tiktok-live-interaction-bubble-spawn-point';
import { TikTokLiveLikeCounter } from '~/components/chat/tiktok-live-like-counter';
import { TikTokLiveStatusBadge } from '~/components/chat/tiktok-live-status-badge';
import { TikTokLiveViewerCounter } from '~/components/chat/tiktok-live-viewer-counter';

const { Title } = Typography;

export function clientLoader({ request }: Route.ClientLoaderArgs) {
	const url = new URL(request.url);
	const username = url.searchParams.get('username');
	invariant(
		username,
		`Username is required in the search params. Example: ?username=your_username`,
	);
	return {
		username,
	};
}

export default function LiveRoute({
	loaderData: { username },
}: Route.ComponentProps) {
	return (
		<>
			<div
				style={{
					paddingTop: '96px',
					paddingBottom: '96px',
					margin: '0 auto',
					maxWidth: '412px',
					height: '100%',
					position: 'relative',
				}}
			>
				<Flex
					vertical
					style={{
						height: '100%',
						position: 'relative',
						overflow: 'hidden',
					}}
				>
					<Flex
						style={{
							width: '100%',
							marginBottom: '8px',
							position: 'relative',
							zIndex: 1,
						}}
						justify="space-between"
						align="baseline"
					>
						<Title
							level={2}
							style={{
								color: 'rgba(255, 255, 255, 0.95)',
								fontSize: '20px',
								paddingBottom: '8px',
								margin: 0,
								textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
								background: 'linear-gradient(45deg, #ffffff, #a78bfa)',
								backgroundClip: 'text',
								WebkitBackgroundClip: 'text',
								WebkitTextFillColor: 'transparent',
							}}
						>
							Messages
						</Title>
					</Flex>
					<TikTokLiveChatFeed style={{ flex: 1 }} />
					<NewUserJoinEventCard
						style={{
							width: '100%',
							marginTop: '8px',
						}}
					/>
				</Flex>
				<TikTokLiveInteractionBubbleSpawnPoint
					style={{
						position: 'absolute',
						right: '0',
						pointerEvents: 'none',
					}}
				/>
			</div>
		</>
	);
}
