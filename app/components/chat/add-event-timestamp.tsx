import type { WebcastMessageEvent } from 'tiktok-live-connector';
import { Flex, Typography } from 'antd';

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
				{new Date(+event.event.createTime).toLocaleTimeString('th', {
					hour: '2-digit',
					minute: '2-digit',
				})}
			</Text>
		</Flex>
	);
};
