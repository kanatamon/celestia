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

export function getGiftCelebrationSourceAspectRatio(): number {
	return PORTRAIT_ASPECT_RATIO;
}

function roundLayoutValue(value: number): number {
	return Math.round(value * 1000) / 1000;
}
