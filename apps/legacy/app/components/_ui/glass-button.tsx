import type { ComponentProps } from 'react';
import { Button as BaseButton } from 'antd';

type ButtonType = Exclude<ComponentProps<typeof BaseButton>['type'], undefined>;
type ButtonColor = 'default' | 'fire';
type GlassButtonProps = Omit<ComponentProps<typeof BaseButton>, 'color'> & {
	color?: ButtonColor;
};

export const glassButtonTypeStyles: Record<ButtonType, React.CSSProperties> = {
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

const glassButtonColorStyles: Record<ButtonColor, React.CSSProperties> = {
	default: {},
	fire: {
		background: 'linear-gradient(90deg, #ef4444 0%, #eab308 100%)',
	},
};

export const GlassButton = ({
	style,
	children,
	type = 'default',
	color = 'default',
	...delegated
}: GlassButtonProps) => {
	const typeStyle = glassButtonTypeStyles[type];
	const colorStyle = glassButtonColorStyles[color];
	return (
		<BaseButton
			{...delegated}
			style={{
				...typeStyle,
				...colorStyle,
				...style,
			}}
		>
			{children}
		</BaseButton>
	);
};
