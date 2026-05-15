import type { QueueItem } from '~/lib/live-event/gift-queue-store';
import type { LiveGiftMessage } from '~/lib/live-event/live-event-store';
import {
	Avatar,
	Checkbox,
	Flex,
	Image,
	Progress,
	Space,
	Typography,
} from 'antd';
import { CircleCheckBig } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	REVERTING_DURATION,
	SETTLING_DURATION,
} from '~/lib/live-event/gift-queue-store';
import { EventTimestamp } from '../event-timestamp';

const { Text } = Typography;

const AnimatedProgress: React.FC<{
	finishedAt: number;
	mode: 'up' | 'down';
}> = ({ finishedAt, mode }) => {
	const [current, setCurrent] = useState(mode === 'up' ? 0 : 100);
	const frameRef = useRef<number | null>(null);

	useEffect(() => {
		const duration = finishedAt - Date.now();

		if (duration <= 0) {
			setCurrent(mode === 'up' ? 100 : 0);
			return;
		}

		const start = Date.now();

		const animate = () => {
			const elapsed = Date.now() - start;
			const progress = Math.min(elapsed / duration, 1); // 0 → 1

			if (mode === 'up') {
				setCurrent(progress * 100);
			} else {
				setCurrent(100 - progress * 100);
			}

			if (progress < 1) {
				frameRef.current = requestAnimationFrame(animate);
			}
		};

		frameRef.current = requestAnimationFrame(animate);

		return () => {
			if (frameRef.current) {
				cancelAnimationFrame(frameRef.current);
			}
		};
	}, [finishedAt, mode]);

	return <Progress type="circle" percent={current} status="exception" />;
};

const DisplayQueue: React.FC<{
	event: QueueItem;
}> = ({ event }) => {
	if (event.state === 'waiting') {
		return <>{event.position}</>;
	}
	if (event.state === 'completed') {
		return <Progress type="circle" percent={100} status="success" />;
	}
	if (event.state === 'settling' && event.settlingAt) {
		return (
			<AnimatedProgress
				finishedAt={event.settlingAt + SETTLING_DURATION}
				mode="up"
			/>
		);
	}
	if (event.state === 'reverting' && event.revertingAt) {
		return (
			<AnimatedProgress
				finishedAt={event.revertingAt + REVERTING_DURATION}
				mode="down"
			/>
		);
	}
	throw new Error(`Unknown event state: ${event.state}`);
};

export const ViewerQueueCard: React.FC<{
	event: QueueItem;
	onPositionClick?: (element: HTMLElement | null) => void;
	onBodyClick?: (element: HTMLElement | null) => void;
}> = ({ event, onPositionClick, onBodyClick }) => {
	const elementRef = useRef<HTMLDivElement>(null);
	return (
		<Flex
			ref={elementRef}
			gap={8}
			style={{
				width: '100%',
				padding: '6px 8px 6px 0px',
				isolation: 'isolate',
				opacity:
					event.state === 'waiting' || event.state === 'reverting' ? 1 : 0.6,
			}}
		>
			<Space
				align="center"
				onClick={() => onPositionClick?.(elementRef.current)}
				style={{ cursor: onPositionClick ? 'pointer' : 'default' }}
			>
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
					<DisplayQueue event={event} />
				</Avatar>
			</Space>
			<Flex
				gap={12}
				style={{
					flex: 1,
					cursor: onBodyClick ? 'pointer' : 'default',
				}}
				onClick={() => onBodyClick?.(elementRef.current)}
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
