import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import type { Route } from './+types/live.$username.feed_';
import { Flex, Space, Splitter } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { LiveChatFeed } from '~/components/live-chat-feed';
import { LiveConnectionAlert } from '~/components/live-connection-alert';
import { LiveInteractionBubbleSpawnPoint } from '~/components/live-interaction-bubble-spawn-point';
import { LiveLikeCounter } from '~/components/live-like-counter';
import { LiveStatusBadge } from '~/components/live-status-badge';
import { LiveViewerCounter } from '~/components/live-viewer-counter';
import { ChatNotification } from '~/lib/chat-notification';
import { ClientOnly } from '~/lib/client-only';
import { NavigationMenu } from '~/lib/navigation/navigation-menu';

export default function FeedRoute({
	params: { username, messageId },
}: Route.ComponentProps) {
	const navigate = useNavigate();

	const updateViewerMessage = (message: LiveFeedMessage | null | undefined) => {
		if (message) {
			navigate(`/live/${username}/feed/messages/${message.id}`, {
				replace: true,
			});
		} else {
			navigate(`/live/${username}/feed`, {
				replace: true,
			});
		}
	};

	return (
		<>
			<div
				style={{
					backgroundImage: 'url(/background_starry_sky.webp)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					width: '100%',
					height: '100%',
					overflow: 'hidden',
				}}
			>
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
					{/* Navigation */}
					<NavigationMenu>
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
					</NavigationMenu>

					{/* Main Content */}
					<Flex
						vertical
						style={{
							flex: 1,
							overflow: 'auto',
							width: '100%',
							height: '100%',
							position: 'relative',
						}}
					>
						<Splitter
							style={{
								flex: 1,
								overflow: 'hidden',
								position: 'relative',
							}}
						>
							<Splitter.Panel
								style={{
									height: '100%',
									overflow: 'hidden',
									paddingRight: '8px',
								}}
							>
								<Outlet />
							</Splitter.Panel>
							<Splitter.Panel
								defaultSize="50%"
								min="30%"
								max="70%"
								style={{
									height: '100%',
									overflow: 'hidden',
									paddingLeft: '8px',
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
									<LiveChatFeed
										style={{ flex: 1 }}
										pinnedMessageId={messageId}
										onPinnedMessageChange={updateViewerMessage}
									/>
								</Flex>
							</Splitter.Panel>
						</Splitter>
					</Flex>
					<ActivityEventSwitch
						style={{
							marginTop: '8px',
						}}
					/>
					<LiveInteractionBubbleSpawnPoint
						style={{
							position: 'absolute',
							bottom: '48px',
							right: '64px',
							pointerEvents: 'none',
						}}
					/>
				</Flex>
			</div>
			<ClientOnly>
				<ChatNotification
				options={{
					enableWhenUserActive: true
				}} />
				<LiveConnectionAlert username={username} />
			</ClientOnly>
		</>
	);
}
