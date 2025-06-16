import type { WebcastMessageEvent } from '~/lib/live-event-types';
import { Flex, Typography } from 'antd';
import { formatDistanceToNowStrict } from 'date-fns';

const { Text } = Typography;

type LiveEvent = {
	id: string;
	event: WebcastMessageEvent;
};

export const AddEventTimestamp: React.FC<{
	event: LiveEvent;
	children: React.ReactNode;
}> = ({ children, event }) => {
	return (
		<Flex align="end" gap={4}>
			{children}
			<Text
				style={{
					fontSize: '10px',
					color: 'rgba(255, 255, 255, 0.5)',
					flexShrink: 0,
				}}
			>
				{formatDistanceToNowStrict(new Date(+event.event.createTime), {
					addSuffix: true,
				})}
			</Text>
		</Flex>
	);
};
