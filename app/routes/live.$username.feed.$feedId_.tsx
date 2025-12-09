import type { LiveFeedMessage } from '~/lib/live-event/live-event-store';
import type { ChatEventFilter } from '~/lib/live-event/use-chat-events';
import type { Route } from './+types/live.$username.feed.$feedId_';
import { Flex, Space, Splitter, Tabs } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { FeedLabel } from '~/components/feed-label';
import { LiveChatFeed } from '~/components/live-chat-feed';
import { LiveInteractionBubbleSpawnPoint } from '~/components/live-interaction-bubble-spawn-point';
import { LiveLikeCounter } from '~/components/live-like-counter';
import { LiveStatusBadge } from '~/components/live-status-badge';
import { LiveViewerCounter } from '~/components/live-viewer-counter';
import { ChatNotification } from '~/lib/chat-notification';
import { ClientOnly } from '~/lib/client-only';
import { useLiveFeedStore } from '~/lib/live-event/live-feed-store';
import { NavigationMenu } from '~/lib/navigation/navigation-menu';

type FeedConfiguration = {
	id: string;
	label?: string | undefined | null;
	labelFilter?: ChatEventFilter;
	chatFilter?: ChatEventFilter;
};

export const FEED_SETTINGS: FeedConfiguration[] = [
	{
		id: '1',
		label: 'ALL',
		labelFilter: {
			reserve: (e) => {
				if (e.type !== 'gift') return false;
				if (e.giftName === 'Heart Me') return true;
				return false;
			},
			diamondCountMin: 30,
		},
	},
	{
		id: '2',
		labelFilter: {
			diamondCountMin: 99,
			diamondCountMax: 299,
		},
		chatFilter: {
			userPaidDiamondMin: 99,
		},
	},
	{
		id: '3',
		labelFilter: {
			diamondCountMin: 299,
			diamondCountMax: 499,
		},
		chatFilter: {
			userPaidDiamondMin: 299,
		},
	},
	{
		id: '4',
		labelFilter: {
			diamondCountMin: 499,
			diamondCountMax: 699,
		},
		chatFilter: {
			userPaidDiamondMin: 499,
		},
	},
	{
		id: '5',
		labelFilter: {
			diamondCountMin: 699,
		},
		chatFilter: {
			userPaidDiamondMin: 699,
		},
	},
];

export default function FeedRoute({
	params: { username, feedId: activeFeedId },
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const updatePinnedMessageIdOnFeeds = useLiveFeedStore(
		(state) => state.updatePinnedMessageIdOnFeeds,
	);
	const getPinnedMessageIdOnFeeds = useLiveFeedStore(
		(state) => state.getPinnedMessageIdOnFeeds,
	);

	const pinMessage = (message: LiveFeedMessage | null | undefined) => {
		if (message) {
			navigate(
				`/live/${username}/feed/${activeFeedId}/messages/${message.id}`,
				{
					replace: true,
				},
			);
			updatePinnedMessageIdOnFeeds(activeFeedId, message.id);
		} else {
			navigate(`/live/${username}/feed/${activeFeedId}`, {
				replace: true,
			});
			updatePinnedMessageIdOnFeeds(activeFeedId, null);
		}
	};

	const navigateToFeed = (feedId: string): void => {
		const messageId = getPinnedMessageIdOnFeeds(feedId);
		if (messageId) {
			navigate(`/live/${username}/feed/${feedId}/messages/${messageId}`, {
				replace: true,
			});
			return;
		}
		navigate(`/live/${username}/feed/${feedId}`, {
			replace: true,
		});
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
					<Tabs
						activeKey={activeFeedId}
						onChange={navigateToFeed}
						className="feed-tabs"
						style={{
							flex: 1,
							overflow: 'hidden',
						}}
						type="card"
						items={FEED_SETTINGS.map((feed) => ({
							key: feed.id,
							label: (
								<FeedLabel
									label={feed.label}
									filter={feed.labelFilter}
									pinnedMessageId={getPinnedMessageIdOnFeeds(feed.id)}
								/>
							),
							children: (
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
												pinnedMessageId={getPinnedMessageIdOnFeeds(feed.id)}
												onPinnedMessageChange={pinMessage}
												filter={feed.chatFilter}
											/>
										</Flex>
									</Splitter.Panel>
								</Splitter>
							),
						}))}
					/>

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
