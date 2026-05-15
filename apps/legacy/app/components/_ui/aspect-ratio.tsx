export const AspectRatio = ({
	ratio = 1,
	children,
	...props
}: {
	ratio?: number;
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
	<div
		{...props}
		style={{
			position: 'relative',
			width: '100%',
			height: 'auto',
			aspectRatio: ratio,
			...props.style,
		}}
	>
		{children}
	</div>
);
