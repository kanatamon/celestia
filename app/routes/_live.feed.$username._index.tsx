import type { Route } from './+types/_live.feed.$username._index';
import { Flex, Splitter, Typography } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { LiveChatFeed } from '~/components/live-chat-feed';
import { LiveInteractionBubbleSpawnPoint } from '~/components/live-interaction-bubble-spawn-point';

const { Title } = Typography;

export default function FeedRoute({
	params: { username, viewerMessageId },
}: Route.ComponentProps) {
	const navigate = useNavigate();
	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
			}}
		>
			<Splitter
				style={{
					height: '100%',
					overflow: 'hidden',
					boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
					position: 'relative',
				}}
			>
				<Splitter.Panel
					defaultSize="50%"
					min="30%"
					max="70%"
					style={{
						height: '100%',
						overflow: 'hidden',
						paddingRight: '8px',
					}}
				>
					<Flex
						vertical
						style={{
							paddingBottom: '24px',
							height: '100%',
							position: 'relative',
							overflow: 'hidden',
						}}
					>
						<LiveChatFeed
							style={{ flex: 1 }}
							pinnedMessageId={viewerMessageId}
							onPinnedMessageChange={(message) => {
								if (message) {
									navigate(`/feed/${username}/viewer/${message.id}`, {
										replace: true,
									});
								} else {
									navigate(`/feed/${username}`, {
										replace: true,
									});
								}
							}}
						/>
						<ActivityEventSwitch
							style={{
								marginTop: '8px',
							}}
						/>
					</Flex>
				</Splitter.Panel>
				<Splitter.Panel
					style={{
						height: '100%',
						overflow: 'hidden',
						paddingLeft: '8px',
					}}
				>
					<Outlet />
				</Splitter.Panel>
			</Splitter>
			<LiveInteractionBubbleSpawnPoint
				style={{
					position: 'absolute',
					right: '0',
					pointerEvents: 'none',
				}}
			/>
		</div>
	);
}
