export interface GiftCelebrationViewport {
	width: number;
	height: number;
}

export type GiftCelebrationFit = 'contain' | 'cover';

export interface GiftCelebrationPaneLayout {
	x: number;
	y: number;
	width: number;
	height: number;
	fit: GiftCelebrationFit;
	mirrored: boolean;
	blurPx: number;
	brightness: number;
	opacity: number;
	zIndex: number;
}

export interface GiftCelebrationTriptychLayout {
	center: GiftCelebrationPaneLayout;
	leftGutter: GiftCelebrationPaneLayout;
	rightGutter: GiftCelebrationPaneLayout;
}

const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;
const PORTRAIT_ASPECT_RATIO = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;

/**
 * Synthesized Gift Icon size as a fraction of the feed-contained portrait height
 * (locked from prototype-celebration-feed-viewport-scale.html, 2026-06-03). The
 * icon is a centred square — deliberately smaller than the Animated kind, which
 * still fills the full contained portrait (mp4Scale = 1.0).
 */
const SYNTHESIZED_ICON_SCALE = 0.4;
const GUTTER_WIDTH_RATIO = 0.42;
const GUTTER_EDGE_OFFSET_RATIO = 0.06;
const GUTTER_BLUR_PX = 10;
const GUTTER_BRIGHTNESS = 0.85;
const GUTTER_OPACITY = 0.6;

export function computeGiftCelebrationTriptychLayout({
	width,
	height,
}: GiftCelebrationViewport): GiftCelebrationTriptychLayout {
	const viewportWidth = Math.max(0, width);
	const viewportHeight = Math.max(0, height);
	const centerScale = Math.min(viewportWidth / PORTRAIT_WIDTH, viewportHeight / PORTRAIT_HEIGHT);
	const centerWidth = roundLayoutValue(PORTRAIT_WIDTH * centerScale);
	const centerHeight = roundLayoutValue(PORTRAIT_HEIGHT * centerScale);
	const centerX = roundLayoutValue((viewportWidth - centerWidth) / 2);
	const centerY = roundLayoutValue((viewportHeight - centerHeight) / 2);
	const gutterWidth = roundLayoutValue(viewportWidth * GUTTER_WIDTH_RATIO);
	const gutterOffset = roundLayoutValue(viewportWidth * GUTTER_EDGE_OFFSET_RATIO);

	return {
		center: {
			x: centerX,
			y: centerY,
			width: centerWidth,
			height: centerHeight,
			fit: 'contain',
			mirrored: false,
			blurPx: 0,
			brightness: 1,
			opacity: 1,
			zIndex: 2,
		},
		leftGutter: {
			x: -gutterOffset,
			y: 0,
			width: gutterWidth,
			height: viewportHeight,
			fit: 'cover',
			mirrored: true,
			blurPx: GUTTER_BLUR_PX,
			brightness: GUTTER_BRIGHTNESS,
			opacity: GUTTER_OPACITY,
			zIndex: 1,
		},
		rightGutter: {
			x: roundLayoutValue(viewportWidth - gutterWidth + gutterOffset),
			y: 0,
			width: gutterWidth,
			height: viewportHeight,
			fit: 'cover',
			mirrored: false,
			blurPx: GUTTER_BLUR_PX,
			brightness: GUTTER_BRIGHTNESS,
			opacity: GUTTER_OPACITY,
			zIndex: 1,
		},
	};
}

/**
 * Layout for a **Synthesized Gift Celebration** icon: a centred square sized off
 * the feed viewport's contained-portrait height (no gutters — the synthesized
 * path never uses them). Smaller than the Animated kind by {@link
 * SYNTHESIZED_ICON_SCALE}. The square is what the breathing icon, its glow, and
 * the fireworks origin are placed against.
 */
export function computeSynthesizedGiftIconLayout({
	width,
	height,
}: GiftCelebrationViewport): GiftCelebrationPaneLayout {
	const viewportWidth = Math.max(0, width);
	const viewportHeight = Math.max(0, height);
	const containScale = Math.min(viewportWidth / PORTRAIT_WIDTH, viewportHeight / PORTRAIT_HEIGHT);
	const containHeight = PORTRAIT_HEIGHT * containScale;
	const size = roundLayoutValue(containHeight * SYNTHESIZED_ICON_SCALE);

	return {
		x: roundLayoutValue((viewportWidth - size) / 2),
		y: roundLayoutValue((viewportHeight - size) / 2),
		width: size,
		height: size,
		fit: 'contain',
		mirrored: false,
		blurPx: 0,
		brightness: 1,
		opacity: 1,
		zIndex: 2,
	};
}

export function getGiftCelebrationSourceAspectRatio(): number {
	return PORTRAIT_ASPECT_RATIO;
}

function roundLayoutValue(value: number): number {
	return Math.round(value * 1000) / 1000;
}
