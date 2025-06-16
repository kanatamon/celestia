type StyleInput = React.CSSProperties | undefined | false | null;

export const cx = (...styles: StyleInput[]): React.CSSProperties => {
	return styles
		.filter((style): style is React.CSSProperties => Boolean(style))
		.reduce((acc, style) => ({ ...acc, ...style }), {});
};
