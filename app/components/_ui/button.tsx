import type { ComponentProps } from 'react';
import { Button as BaseButton } from 'antd';

export const Button = ({
	style,
	children,
	type = 'default',
	...delegated
}: ComponentProps<typeof BaseButton>) => {
	let preferredStyle = {};
	if (type === 'default') {
		preferredStyle = {
			background: 'rgba(255, 255, 255, 0.2)',
			backdropFilter: 'blur(10px)',
			border: '1px solid rgba(255, 255, 255, 0.3)',
			color: 'rgba(255, 255, 255, 0.95)',
			padding: '6px 12px',
			cursor: 'pointer',
		} satisfies React.CSSProperties;
	}
	if (type === 'text') {
		preferredStyle = {
			background: 'transparent',
			color: 'rgba(255, 255, 255, 0.95)',
			boxShadow: 'none',
			padding: '6px 12px',
			cursor: 'pointer',
			border: 'none',
		} satisfies React.CSSProperties;
	}
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
