import type { WebcastMessageEvent } from '~/lib/live-event/live-event-types';
import { Flex, Typography } from 'antd';
import { useState } from 'react';
import { formatRelativeTime } from '~/lib/date';
import { useInterval } from '~/lib/use-interval';

const { Text } = Typography;

type LiveEvent = {
	id: string;
	event: WebcastMessageEvent;
};

const getUpdateInterval = (relativeTime: string): number => {
	if (relativeTime.includes('now')) {
		return 1000 * 5; // Update every 5 seconds
	}
	if (relativeTime.includes('s')) {
		return 1000 * 5; // Update every 5 seconds
	}
	if (relativeTime.includes('m')) {
		return 1000 * 60; // Update every minute
	}
	if (relativeTime.includes('h')) {
		return 1000 * 60 * 60; // Update every hour
	}
	return 1000 * 60 * 60 * 24; // Update every day
};

export const AddEventTimestamp: React.FC<{
	event: LiveEvent;
	children: React.ReactNode;
	timestampStyle?: React.CSSProperties;
}> = ({ children, event, timestampStyle = {} }) => {
	const [relativeTime, setRelativeTime] = useState(() =>
		formatRelativeTime(new Date(+event.event.createTime)),
	);
	const updateInterval = getUpdateInterval(relativeTime);
	useInterval(() => {
		setRelativeTime(formatRelativeTime(new Date(+event.event.createTime)));
	}, updateInterval);
	return (
		<Flex align="end" gap={4}>
			{children}
			<Text
				style={{
					fontSize: '10px',
					color: 'rgba(255, 255, 255, 0.5)',
					flexShrink: 0,
					isolation: 'isolate',
					...timestampStyle,
				}}
			>
				{relativeTime}
			</Text>
		</Flex>
	);
};
