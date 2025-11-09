import type { QueueItem } from '~/lib/live-event/gift-queue-store';
import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import { Avatar, Checkbox, Flex, Image, Space, Typography } from 'antd';
import { CircleCheckBig } from 'lucide-react';
import { EventTimestamp } from '../event-timestamp';

const { Text } = Typography;

export const ViewerQueueCard: React.FC<{
	event: QueueItem;
	onPositionClick?: () => void;
	onBodyClick?: () => void;
}> = ({ event, onPositionClick, onBodyClick }) => {
	return (
		<Flex
			gap={8}
			style={{
				width: '100%',
				padding: '6px 8px 6px 0px',
				isolation: 'isolate',
				opacity: event.state === 'waiting' ? 1 : 0.6,
			}}
		>
			<Space
				align="center"
				onClick={onPositionClick}
				style={{ cursor: onPositionClick ? 'pointer' : 'default' }}
			>
				{['completed', 'reverting'].includes(event.state) ? (
					<Avatar
						size={36}
						shape="square"
						style={{
							backgroundColor: 'rgba(0, 0, 0, 0.6)',
						}}
						icon={
							<CircleCheckBig
								style={{
									color: 'rgba(0, 255, 128, 0.85)',
									filter: 'drop-shadow(0 0 6px rgba(0, 255, 128, 0.7))',
								}}
							/>
						}
					/>
				) : (
					<Avatar
						size={36}
						shape="square"
						style={{
							backgroundColor: 'rgba(0, 0, 0, 0.6)',
							color: 'rgba(255, 223, 0, 0.95)',
							fontWeight: 'bold',
							fontSize: '16px',
						}}
					>
						{event.position}
					</Avatar>
				)}
			</Space>
			<Flex
				gap={12}
				style={{
					flex: 1,
					cursor: onBodyClick ? 'pointer' : 'default',
				}}
				onClick={onBodyClick}
			>
				<Space align="center">
					<Avatar
						src={event.gift.userDetails.profilePictureUrls?.at(-1)}
						size={36}
					/>
				</Space>
				<Flex vertical justify="space-between">
					<Text
						strong
						style={{
							color: 'rgba(255, 223, 0, 0.95)',
							fontSize: '14px',
							textShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
						}}
					>
						{event.gift.nickname || 'Anonymous'}
					</Text>
					<Text
						style={{
							color: 'rgba(255, 223, 0, 0.7)',
							fontSize: '10px',
							textShadow: '0 0 6px rgba(255, 223, 0, 0.6)',
						}}
					>
						{`Sent ${event.gift.giftName || 'a gift'} (${event.gift.diamondCount.toLocaleString()} diamond${
							event.gift.diamondCount > 1 ? 's' : ''
						})`}
					</Text>
				</Flex>
				<Space size={8} align="end">
					<Image
						preview={false}
						width={40}
						alt={event.gift.giftName}
						src={event.gift.giftPictureUrl}
					/>
					<Space
						size={2}
						align="baseline"
						style={{
							fontStyle: 'italic',
							color: 'rgba(255, 223, 0, 0.95)',
							fontWeight: 'bold',
							textShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
						}}
					>
						<Text
							style={{
								color: 'currentcolor',
								fontSize: '14px',
							}}
						>
							x
						</Text>
						<Text
							style={{
								color: 'currentcolor',
								fontSize: '20px',
								textShadow: '0 0 10px rgba(255, 223, 0, 1)',
							}}
						>
							{event.gift.repeatCount}
						</Text>
					</Space>
				</Space>
				<Space align="end">
					<EventTimestamp
						event={event.gift}
						style={{
							color: 'inherit',
							fontSize: '10px',
							textShadow: 'inherit',
						}}
					/>
				</Space>
			</Flex>
		</Flex>
	);
};
