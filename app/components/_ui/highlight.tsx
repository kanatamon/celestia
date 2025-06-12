import { Avatar, Image, Space, Typography } from 'antd';

const { Text } = Typography;

export function Highlight({
	children,
	style,
}: {
	children: string | string[];
	style?: React.CSSProperties;
}) {
	return (
		<Text
			style={{
				color: '#a78bfa',
				fontWeight: 'bold',
				textShadow: '0 0 8px rgba(167, 139, 250, 0.3)',
				...style,
			}}
		>
			{children}
		</Text>
	);
}
