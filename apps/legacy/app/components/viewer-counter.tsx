import { Space, Typography } from 'antd';
import { Telescope } from 'lucide-react';

const { Text } = Typography;

export const ViewerCounter: React.FC<{
	viewerCount: number;
}> = ({ viewerCount }) => {
	return (
		<Space
			style={{
				background: 'rgba(255, 255, 255, 0.05)',
				backdropFilter: 'blur(40px)',
				border: '1px solid rgba(255, 255, 255, 0.1)',
				borderRadius: '24px',
				padding: '2px 8px',
				position: 'relative',
				overflow: 'hidden',
				color: 'rgba(255, 255, 255, 0.95)',
			}}
			align="center"
		>
			<Telescope size={20} color="currentcolor" />
			<Text
				style={{
					color: 'currentcolor',
					fontSize: '14px',
					fontWeight: '600',
					textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
					letterSpacing: '0.5px',
				}}
			>
				{`${viewerCount.toLocaleString()} viewers`}
			</Text>
		</Space>
	);
};
