import type { ComponentProps } from 'react';
import { Button as BaseButton } from 'antd';

type ButtonType = Exclude<ComponentProps<typeof BaseButton>['type'], undefined>;

export const glassButtonStyles: Record<ButtonType, React.CSSProperties> = {
	default: {
		background: 'rgba(255, 255, 255, 0.2)',
		backdropFilter: 'blur(10px)',
		border: '1px solid rgba(255, 255, 255, 0.3)',
		color: 'rgba(255, 255, 255, 0.95)',
		padding: '6px 12px',
		cursor: 'pointer',
	},
	text: {
		background: 'transparent',
		color: 'rgba(255, 255, 255, 0.95)',
		boxShadow: 'none',
		padding: '6px 12px',
		cursor: 'pointer',
		border: 'none',
	},
	dashed: {},
	link: {},
	primary: {},
};

export const GlassButton = ({
	style,
	children,
	type = 'default',
	...delegated
}: ComponentProps<typeof BaseButton>) => {
	const preferredStyle = glassButtonStyles[type];
	return (
		<BaseButton
			key="close"
			{...delegated}
			style={{
				...preferredStyle,
				...style,
			}}
		>
			{children}
		</BaseButton>
	);
};
