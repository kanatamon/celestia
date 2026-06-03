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

		// 437 is between 299 and 999; midpoint is 649 → 437 is nearer 299.
		expect(createCelebrationSettings({ storage: memoryStorage(437) }).getThreshold()).toBe(299);

		// 60000 is above 999 → snaps to 999.
		expect(createCelebrationSettings({ storage: memoryStorage(60000) }).getThreshold()).toBe(999);

		// 0 is below 1 → snaps to 1.
		expect(createCelebrationSettings({ storage: memoryStorage(0) }).getThreshold()).toBe(1);

		// Midpoint between 1 and 30 is 15.5; 15 is nearer 1.
		expect(createCelebrationSettings({ storage: memoryStorage(15) }).getThreshold()).toBe(1);

		// 16 is nearer 30.
		expect(createCelebrationSettings({ storage: memoryStorage(16) }).getThreshold()).toBe(30);
	});

	it('persists a snapped threshold through storage', () => {
		const storage = memoryStorage();
		const setThreshold = vi.spyOn(storage, 'setThreshold');
		const settings = createCelebrationSettings({ storage });

		// 123 snaps to 99 (|123-99|=24 vs |123-299|=176).
		settings.setThreshold(123);
		expect(setThreshold).toHaveBeenCalledWith(99);
		expect(settings.getThreshold()).toBe(99);

		// 1 is an exact tier.
		settings.setThreshold(1);
		expect(settings.getThreshold()).toBe(1);
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
		expect(normalizeThreshold(0)).toBe(1);
		expect(normalizeThreshold(1)).toBe(1);
		expect(normalizeThreshold(15)).toBe(1);
		expect(normalizeThreshold(16)).toBe(30);
		expect(normalizeThreshold(30)).toBe(30);
		expect(normalizeThreshold(64)).toBe(30); // |64-30|=34 vs |64-99|=35 → 30
		expect(normalizeThreshold(65)).toBe(99); // |65-30|=35 vs |65-99|=34 → 99
		expect(normalizeThreshold(99)).toBe(99);
		expect(normalizeThreshold(299)).toBe(299);
		expect(normalizeThreshold(649)).toBe(299); // |649-299|=350 vs |649-999|=350 → tie → first wins (299)
		expect(normalizeThreshold(650)).toBe(999); // |650-299|=351 vs |650-999|=349 → 999
		expect(normalizeThreshold(999)).toBe(999);
		expect(normalizeThreshold(999999)).toBe(999);
	});
});
