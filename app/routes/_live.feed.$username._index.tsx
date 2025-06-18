import type { Route } from './+types/_live.feed.$username._index';
import { Flex, Splitter } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { LiveChatFeed } from '~/components/live-chat-feed';

export default function FeedRoute({
	params: { username, viewerMessageId },
}: Route.ComponentProps) {
	const navigate = useNavigate();
	return (
		<Flex
			vertical
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
			}}
		>
			<Splitter
				style={{
					flex: 1,
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
			<ActivityEventSwitch
				style={{
					marginTop: '8px',
				}}
			/>
		</Flex>
	);
}
