import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import type { ChatEventFilter } from '~/lib/live-event/use-chat-events';
import type { Route } from './+types/live.$username.messages_';
import { Flex, Space, Splitter, Tabs } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { FeedLabel } from '~/components/feed-label';
import { LiveChatFeed } from '~/components/live-chat-feed';
import { LiveInteractionBubbleSpawnPoint } from '~/components/live-interaction-bubble-spawn-point';
import { LiveLikeCounter } from '~/components/live-like-counter';
import { LiveStatusBadge } from '~/components/live-status-badge';
import { LiveViewerCounter } from '~/components/live-viewer-counter';
import { ViewerQueueFeed } from '~/components/viewer-queue-feed';
import { ChatNotification } from '~/lib/chat-notification';
import { ClientOnly } from '~/lib/client-only';
import { useLiveFeedStore } from '~/lib/live-event/live-feed-store';
import { NavigationMenu } from '~/lib/navigation/navigation-menu';

export default function MessagesRoute({
	params: { username, messageId },
}: Route.ComponentProps) {
	const navigate = useNavigate();

	const pinMessage = (message: LiveFeedMessage | null | undefined) => {
		if (message) {
			navigate(`/live/${username}/messages/${message.id}`, {
				replace: true,
			});
		} else {
			navigate(`/live/${username}/messages`, {
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

					<Splitter
						style={{
							height: '100%',
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
							<Splitter layout="vertical">
								<Splitter.Panel
									defaultSize="40%"
									min="20%"
									max="60%"
									style={{
										paddingBottom: '8px',
									}}
								>
									<ViewerQueueFeed
										pinnedMessageId={messageId}
										onPinnedMessageChange={pinMessage}
									/>
								</Splitter.Panel>
								<Splitter.Panel
									style={{
										paddingTop: '8px',
									}}
								>
									<Outlet />
								</Splitter.Panel>
							</Splitter>
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
									onPinnedMessageChange={pinMessage}
								/>
							</Flex>
						</Splitter.Panel>
					</Splitter>

					<ActivityEventSwitch
						style={{
							marginTop: '8px',
						}}
					/>
					<LiveInteractionBubbleSpawnPoint
						style={{
							position: 'absolute',
							bottom: '48px',
							right: '100px',
							pointerEvents: 'none',
						}}
					/>
				</Flex>
			</div>
			<ClientOnly>
				<ChatNotification
					options={{
						enableWhenUserActive: true,
					}}
				/>
			</ClientOnly>
		</>
	);
}
