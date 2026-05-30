export interface GiftParadeMotionInput {
	barWidth: number;
	paradeWidth: number;
	speedPxPerSec: number;
}

export type GiftParadeMotion =
	| { kind: 'parked' }
	| { kind: 'scroll'; fromPx: number; toPx: number; durationMs: number };

export function computeGiftParadeMotion(input: GiftParadeMotionInput): GiftParadeMotion {
	const { barWidth, paradeWidth, speedPxPerSec } = input;

	if (barWidth <= 0 || speedPxPerSec <= 0 || paradeWidth <= barWidth) {
		return { kind: 'parked' };
	}

	const distancePx = barWidth + paradeWidth;
	const durationMs = (distancePx / speedPxPerSec) * 1000;

	return { kind: 'scroll', fromPx: barWidth, toPx: -paradeWidth, durationMs };
}
