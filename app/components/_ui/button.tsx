import { Button as BaseButton } from 'antd';

export const Button = ({
	style,
	children,
	...delegated
}: {
	htmlType?: 'button' | 'submit' | 'reset';
	style?: React.CSSProperties;
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	children?: React.ReactNode;
}) => {
	return (
		<BaseButton
			key="close"
			{...delegated}
			style={{
				background: 'rgba(255, 255, 255, 0.2)',
				backdropFilter: 'blur(10px)',
				border: '1px solid rgba(255, 255, 255, 0.3)',
				color: 'rgba(255, 255, 255, 0.95)',
				borderRadius: '8px',
				padding: '6px 12px',
				cursor: 'pointer',
				...style,
			}}
		>
			{children}
		</BaseButton>
	);
};
