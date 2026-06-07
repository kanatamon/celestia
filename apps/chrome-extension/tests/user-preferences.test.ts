import { describe, expect, it } from 'vitest';
import {
	createCelebrationSettingsStorage,
	createLikeMotionSettingsStorage,
	createSoundManagerStorage,
	createUserPreferencesStore,
	type UserPreferenceKey,
} from '../src/user-preferences/user-preferences.js';

describe('user preferences store', () => {
	it('returns defaults for missing preferences and round-trips values through chrome.storage.local', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		await expect(preferences.getRecentStreamerUsername()).resolves.toBeNull();
		await expect(preferences.getVolume('master')).resolves.toBe(100);
		await expect(preferences.getVolume('chat')).resolves.toBe(30);
		await expect(preferences.getVolume('gift')).resolves.toBe(50);
		await expect(preferences.isTraceModeEnabled()).resolves.toBe(false);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(99);

		await preferences.setRecentStreamerUsername('celestia');
		await preferences.setVolume('master', 40);
		await preferences.setVolume('chat', 25);
		await preferences.setVolume('gift', 75);
		await preferences.setTraceModeEnabled(true);
		// 299 is the nearest tier to 250.
		await preferences.setCelebrationThreshold(299);

		await expect(preferences.getRecentStreamerUsername()).resolves.toBe('celestia');
		await expect(preferences.getVolume('master')).resolves.toBe(40);
		await expect(preferences.getVolume('chat')).resolves.toBe(25);
		await expect(preferences.getVolume('gift')).resolves.toBe(75);
		await expect(preferences.isTraceModeEnabled()).resolves.toBe(true);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(299);
		expect(storageArea.values).toEqual(
			new Map<UserPreferenceKey, unknown>([
				['recentStreamerUsername', 'celestia'],
				['volume.master', 40],
				['volume.chat', 25],
				['volume.gift', 75],
				['celestia.trace', true],
				['celebration.diamondThreshold', 299],
			]),
		);

		await preferences.setRecentStreamerUsername(null);
		await preferences.setTraceModeEnabled(false);

		await expect(preferences.getRecentStreamerUsername()).resolves.toBeNull();
		await expect(preferences.isTraceModeEnabled()).resolves.toBe(false);
	});

	it('snaps the celebration threshold to the nearest discrete tier on read and write', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		// 10 → nearest tier is 30.
		await preferences.setCelebrationThreshold(10);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(30);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(30);

		// 999999 → nearest tier is 899.
		await preferences.setCelebrationThreshold(999999);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(899);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(899);

		// 123.7 → rounds then snaps to nearest tier; 124 is nearest to 99 (|124-99|=25 vs |124-199|=75).
		await preferences.setCelebrationThreshold(123.7);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(99);

		// Non-numeric stored value → default 99.
		storageArea.values.set('celebration.diamondThreshold', 'not-a-number');
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(99);

		// 5 → nearest tier is 30.
		storageArea.values.set('celebration.diamondThreshold', 5);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(30);
	});

	it('hydrates Celebration Settings storage from preferences and persists threshold updates', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		// 250 → snapped to nearest tier (299).
		storageArea.values.set('celebration.diamondThreshold', 250);
		const preferences = createUserPreferencesStore(storageArea);

		const celebrationStorage = await createCelebrationSettingsStorage(preferences);

		// Hydrated synchronously from the persisted preference (snapped to 299).
		expect(celebrationStorage.getThreshold()).toBe(299);

		// 500 → snapped to 499 (|500-499|=1 vs |500-299|=201).
		await celebrationStorage.setThreshold(500);

		// The cache updates immediately (so the live trigger sees it) and persists.
		expect(celebrationStorage.getThreshold()).toBe(499);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(499);
	});

	it('defaults Celebration Settings storage to 99 when the preference is unset', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		const celebrationStorage = await createCelebrationSettingsStorage(preferences);

		expect(celebrationStorage.getThreshold()).toBe(99);
	});

	it('defaults Reduced Like Motion to off and round-trips it through chrome.storage.local', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		// Default is off (full motion) when the preference is unset.
		await expect(preferences.getReducedLikeMotion()).resolves.toBe(false);

		await preferences.setReducedLikeMotion(true);
		expect(storageArea.values.get('likeLayer.reducedMotion')).toBe(true);
		await expect(preferences.getReducedLikeMotion()).resolves.toBe(true);

		await preferences.setReducedLikeMotion(false);
		expect(storageArea.values.get('likeLayer.reducedMotion')).toBe(false);
		await expect(preferences.getReducedLikeMotion()).resolves.toBe(false);
	});

	it('coerces a non-boolean stored Reduced Like Motion value to the off default', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		storageArea.values.set('likeLayer.reducedMotion', 'nonsense');
		await expect(preferences.getReducedLikeMotion()).resolves.toBe(false);

		// Persisted string '1'/'true' read back as on (storage round-trips booleans,
		// but a legacy/foreign value is interpreted leniently).
		storageArea.values.set('likeLayer.reducedMotion', '1');
		await expect(preferences.getReducedLikeMotion()).resolves.toBe(true);
	});

	it('hydrates Reduced Like Motion storage from preferences and persists updates', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		storageArea.values.set('likeLayer.reducedMotion', true);
		const preferences = createUserPreferencesStore(storageArea);

		const likeMotionStorage = await createLikeMotionSettingsStorage(preferences);

		// Hydrated synchronously from the persisted preference.
		expect(likeMotionStorage.getReducedMotion()).toBe(true);

		await likeMotionStorage.setReducedMotion(false);

		// The cache updates immediately (so the live Like Layer sees it) and persists.
		expect(likeMotionStorage.getReducedMotion()).toBe(false);
		expect(storageArea.values.get('likeLayer.reducedMotion')).toBe(false);
	});

	it('defaults Reduced Like Motion storage to off when the preference is unset', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		const likeMotionStorage = await createLikeMotionSettingsStorage(preferences);

		expect(likeMotionStorage.getReducedMotion()).toBe(false);
	});

	it('hydrates SoundManager storage from preferences and persists volume updates', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		storageArea.values.set('volume.master', 40);
		storageArea.values.set('volume.chat', 25);
		const preferences = createUserPreferencesStore(storageArea);

		const soundManagerStorage = await createSoundManagerStorage(preferences);

		expect(soundManagerStorage.getVolume('master')).toBe(40);
		expect(soundManagerStorage.getVolume('chat')).toBe(25);
		expect(soundManagerStorage.getVolume('gift')).toBe(50);

		await soundManagerStorage.setVolume('gift', 75);

		expect(soundManagerStorage.getVolume('gift')).toBe(75);
		expect(storageArea.values.get('volume.gift')).toBe(75);
	});
});

class FakeChromeLocalStorageArea {
	readonly values = new Map<UserPreferenceKey, unknown>();

	async get(key: UserPreferenceKey): Promise<Record<string, unknown>> {
		return { [key]: this.values.get(key) };
	}

	async set(items: Partial<Record<UserPreferenceKey, unknown>>): Promise<void> {
		for (const [key, value] of Object.entries(items) as [UserPreferenceKey, unknown][]) {
			this.values.set(key, value);
		}
	}

	async remove(key: UserPreferenceKey): Promise<void> {
		this.values.delete(key);
	}
}
