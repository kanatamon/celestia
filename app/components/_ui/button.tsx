import type { ComponentProps } from 'react';
import { Button as BaseButton } from 'antd';

export const Button = ({
	style,
	children,
	...delegated
}: ComponentProps<typeof BaseButton>) => {
	return (
		<BaseButton
			key="close"
			{...delegated}
			style={{
				background: 'rgba(255, 255, 255, 0.2)',
				backdropFilter: 'blur(10px)',
				border: '1px solid rgba(255, 255, 255, 0.3)',
				color: 'rgba(255, 255, 255, 0.95)',
				padding: '6px 12px',
				cursor: 'pointer',
				...style,
			}}
		>
			{children}
		</BaseButton>
	);
};
