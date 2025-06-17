import { Typography } from 'antd';

const { Text } = Typography;

export const CenteredMessageOverlay: React.FC<{
	children: React.ReactNode;
	textStyle?: React.CSSProperties;
}> = ({ children, textStyle }) => {
	return (
		<div
			style={{
				display: 'grid',
				placeItems: 'center',
				width: '100%',
				height: '100%',
			}}
		>
			<Text
				style={{
					fontSize: '14px',
					color: 'rgba(255, 255, 255, 0.95)',
					textAlign: 'center',
					...textStyle,
				}}
			>
				{children}
			</Text>
		</div>
	);
};
