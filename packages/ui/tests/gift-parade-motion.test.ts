import { describe, expect, it } from 'vitest';
import { computeGiftParadeMotion } from '../src/gift-parade-motion.js';

describe('computeGiftParadeMotion', () => {
	it('parks the parade when it fits within the bar', () => {
		const motion = computeGiftParadeMotion({
			barWidth: 300,
			paradeWidth: 200,
			speedPxPerSec: 90,
		});

		expect(motion).toEqual({ kind: 'parked' });
	});

	it('scrolls from the bar right edge to fully off the left when the parade overflows', () => {
		const motion = computeGiftParadeMotion({
			barWidth: 300,
			paradeWidth: 900,
			speedPxPerSec: 90,
		});

		expect(motion.kind).toBe('scroll');
		if (motion.kind !== 'scroll') return;
		expect(motion.fromPx).toBe(300);
		expect(motion.toPx).toBe(-900);
	});

	it('keeps a constant pixel speed so more gifts take proportionally longer', () => {
		const shortParade = computeGiftParadeMotion({
			barWidth: 300,
			paradeWidth: 600,
			speedPxPerSec: 90,
		});
		const longParade = computeGiftParadeMotion({
			barWidth: 300,
			paradeWidth: 1500,
			speedPxPerSec: 90,
		});

		if (shortParade.kind !== 'scroll' || longParade.kind !== 'scroll') {
			throw new Error('Expected both parades to scroll.');
		}

		// distance = barWidth + paradeWidth, travelled at speedPxPerSec.
		expect(shortParade.durationMs).toBeCloseTo(((300 + 600) / 90) * 1000);
		expect(longParade.durationMs).toBeCloseTo(((300 + 1500) / 90) * 1000);
		// twice the travel distance => twice the time.
		expect(longParade.durationMs).toBeCloseTo(shortParade.durationMs * 2);
	});

	it('parks instead of dividing by zero when speed is not positive', () => {
		const motion = computeGiftParadeMotion({
			barWidth: 300,
			paradeWidth: 900,
			speedPxPerSec: 0,
		});

		expect(motion).toEqual({ kind: 'parked' });
	});

	it('parks while the bar width is still unmeasured', () => {
		const motion = computeGiftParadeMotion({
			barWidth: 0,
			paradeWidth: 900,
			speedPxPerSec: 90,
		});

		expect(motion).toEqual({ kind: 'parked' });
	});
});
