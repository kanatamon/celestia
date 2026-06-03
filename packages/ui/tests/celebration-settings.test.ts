import { describe, expect, it, vi } from 'vitest';
import {
	CELEBRATION_THRESHOLD_DEFAULT,
	CELEBRATION_THRESHOLD_MAX,
	CELEBRATION_THRESHOLD_MIN,
	type CelebrationSettingsStorage,
	createCelebrationSettings,
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

	it('reads the stored threshold and clamps out-of-range values', () => {
		expect(createCelebrationSettings({ storage: memoryStorage(250) }).getThreshold()).toBe(250);
		expect(createCelebrationSettings({ storage: memoryStorage(5) }).getThreshold()).toBe(
			CELEBRATION_THRESHOLD_MIN,
		);
		expect(createCelebrationSettings({ storage: memoryStorage(99999) }).getThreshold()).toBe(
			CELEBRATION_THRESHOLD_MAX,
		);
	});

	it('persists a clamped, rounded threshold through storage', () => {
		const storage = memoryStorage();
		const setThreshold = vi.spyOn(storage, 'setThreshold');
		const settings = createCelebrationSettings({ storage });

		settings.setThreshold(123.7);
		expect(setThreshold).toHaveBeenCalledWith(124);
		expect(settings.getThreshold()).toBe(124);

		settings.setThreshold(1);
		expect(settings.getThreshold()).toBe(CELEBRATION_THRESHOLD_MIN);
	});
});
