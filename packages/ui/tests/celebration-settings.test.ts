import { describe, expect, it, vi } from 'vitest';
import {
	CELEBRATION_THRESHOLD_DEFAULT,
	CELEBRATION_THRESHOLD_TIERS,
	type CelebrationSettingsStorage,
	createCelebrationSettings,
	normalizeThreshold,
} from '../src/celebration-settings.js';

function memoryStorage(initial?: number): CelebrationSettingsStorage {
	let value = initial;
	return {
		getThreshold: () => value,
		setThreshold: (next) => {
			value = next;
		},
	};
}

describe('celebration settings', () => {
	it('returns the default threshold when storage is empty', () => {
		const settings = createCelebrationSettings({ storage: memoryStorage() });
		expect(settings.getThreshold()).toBe(CELEBRATION_THRESHOLD_DEFAULT);
	});

	it('snaps stored value to the nearest tier', () => {
		// Exact tiers pass through.
		for (const tier of CELEBRATION_THRESHOLD_TIERS) {
			expect(createCelebrationSettings({ storage: memoryStorage(tier) }).getThreshold()).toBe(tier);
		}

		// Legacy stored value 99 → still 99 (exact tier).
		expect(createCelebrationSettings({ storage: memoryStorage(99) }).getThreshold()).toBe(99);

		// 437 is between 299 and 499; midpoint is 399 → 437 is nearer 499.
		expect(createCelebrationSettings({ storage: memoryStorage(437) }).getThreshold()).toBe(499);

		// 60000 is above 899 → snaps to 899.
		expect(createCelebrationSettings({ storage: memoryStorage(60000) }).getThreshold()).toBe(899);

		// 0 is below 30 → snaps to 30.
		expect(createCelebrationSettings({ storage: memoryStorage(0) }).getThreshold()).toBe(30);

		// Anything below the lowest tier snaps up to 30.
		expect(createCelebrationSettings({ storage: memoryStorage(15) }).getThreshold()).toBe(30);

		// 64 is nearer 30 than 99 (|64-30|=34 vs |64-99|=35).
		expect(createCelebrationSettings({ storage: memoryStorage(64) }).getThreshold()).toBe(30);
	});

	it('persists a snapped threshold through storage', () => {
		const storage = memoryStorage();
		const setThreshold = vi.spyOn(storage, 'setThreshold');
		const settings = createCelebrationSettings({ storage });

		// 123 snaps to 99 (|123-99|=24 vs |123-299|=176).
		settings.setThreshold(123);
		expect(setThreshold).toHaveBeenCalledWith(99);
		expect(settings.getThreshold()).toBe(99);

		// 30 is an exact tier.
		settings.setThreshold(30);
		expect(settings.getThreshold()).toBe(30);
	});
});

describe('normalizeThreshold', () => {
	it('returns the default for non-finite inputs', () => {
		expect(normalizeThreshold(null)).toBe(CELEBRATION_THRESHOLD_DEFAULT);
		expect(normalizeThreshold(undefined)).toBe(CELEBRATION_THRESHOLD_DEFAULT);
		expect(normalizeThreshold(Number.NaN)).toBe(CELEBRATION_THRESHOLD_DEFAULT);
		expect(normalizeThreshold('foo')).toBe(CELEBRATION_THRESHOLD_DEFAULT);
	});

	it('snaps to nearest tier for arbitrary values', () => {
		expect(normalizeThreshold(0)).toBe(30); // below lowest tier → 30
		expect(normalizeThreshold(15)).toBe(30);
		expect(normalizeThreshold(30)).toBe(30);
		expect(normalizeThreshold(64)).toBe(30); // |64-30|=34 vs |64-99|=35 → 30
		expect(normalizeThreshold(65)).toBe(99); // |65-30|=35 vs |65-99|=34 → 99
		expect(normalizeThreshold(99)).toBe(99);
		expect(normalizeThreshold(149)).toBe(99); // |149-99|=50 vs |149-199|=50 → tie → first wins (99)
		expect(normalizeThreshold(150)).toBe(199); // |150-99|=51 vs |150-199|=49 → 199
		expect(normalizeThreshold(199)).toBe(199);
		expect(normalizeThreshold(249)).toBe(199); // |249-199|=50 vs |249-299|=50 → tie → first wins (199)
		expect(normalizeThreshold(250)).toBe(299); // |250-199|=51 vs |250-299|=49 → 299
		expect(normalizeThreshold(299)).toBe(299);
		expect(normalizeThreshold(399)).toBe(299); // |399-299|=100 vs |399-499|=100 → tie → first wins (299)
		expect(normalizeThreshold(400)).toBe(499); // |400-299|=101 vs |400-499|=99 → 499
		expect(normalizeThreshold(499)).toBe(499);
		expect(normalizeThreshold(699)).toBe(499); // |699-499|=200 vs |699-899|=200 → tie → first wins (499)
		expect(normalizeThreshold(700)).toBe(899); // |700-499|=201 vs |700-899|=199 → 899
		expect(normalizeThreshold(899)).toBe(899);
		expect(normalizeThreshold(999999)).toBe(899);
	});
});
