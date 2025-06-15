import type { Route } from './+types/_tiktok-live-guard.live-feed';
import { Flex, Typography } from 'antd';
import { ActivityEventSwitch } from '~/components/activity-event-switch';
import { LiveChatFeed } from '~/components/live-chat-feed';
import { LiveInteractionBubbleSpawnPoint } from '~/components/live-interaction-bubble-spawn-point';

const { Title } = Typography;

export default function LiveRoute({}: Route.ComponentProps) {
	return (
		<>
			<div
				style={{
					paddingBottom: '24px',
					margin: '0 auto',
					maxWidth: '480px',
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
					<LiveChatFeed style={{ flex: 1 }} />
					<ActivityEventSwitch
						style={{
							marginTop: '8px',
						}}
					/>
				</Flex>
				<LiveInteractionBubbleSpawnPoint
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
