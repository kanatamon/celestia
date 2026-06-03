import { describe, expect, it } from 'vitest';
import {
	createCelebrationSettingsStorage,
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
		await preferences.setCelebrationThreshold(250);

		await expect(preferences.getRecentStreamerUsername()).resolves.toBe('celestia');
		await expect(preferences.getVolume('master')).resolves.toBe(40);
		await expect(preferences.getVolume('chat')).resolves.toBe(25);
		await expect(preferences.getVolume('gift')).resolves.toBe(75);
		await expect(preferences.isTraceModeEnabled()).resolves.toBe(true);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(250);
		expect(storageArea.values).toEqual(
			new Map<UserPreferenceKey, unknown>([
				['recentStreamerUsername', 'celestia'],
				['volume.master', 40],
				['volume.chat', 25],
				['volume.gift', 75],
				['celestia.trace', true],
				['celebration.diamondThreshold', 250],
			]),
		);

		await preferences.setRecentStreamerUsername(null);
		await preferences.setTraceModeEnabled(false);

		await expect(preferences.getRecentStreamerUsername()).resolves.toBeNull();
		await expect(preferences.isTraceModeEnabled()).resolves.toBe(false);
	});

	it('clamps the celebration threshold to its valid range on read and write', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		await preferences.setCelebrationThreshold(10);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(30);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(30);

		await preferences.setCelebrationThreshold(999999);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(50000);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(50000);

		await preferences.setCelebrationThreshold(123.7);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(124);

		storageArea.values.set('celebration.diamondThreshold', 'not-a-number');
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(99);

		storageArea.values.set('celebration.diamondThreshold', 5);
		await expect(preferences.getCelebrationThreshold()).resolves.toBe(30);
	});

	it('hydrates Celebration Settings storage from preferences and persists threshold updates', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		storageArea.values.set('celebration.diamondThreshold', 250);
		const preferences = createUserPreferencesStore(storageArea);

		const celebrationStorage = await createCelebrationSettingsStorage(preferences);

		// Hydrated synchronously from the persisted preference.
		expect(celebrationStorage.getThreshold()).toBe(250);

		await celebrationStorage.setThreshold(500);

		// The cache updates immediately (so the live trigger sees it) and persists.
		expect(celebrationStorage.getThreshold()).toBe(500);
		expect(storageArea.values.get('celebration.diamondThreshold')).toBe(500);
	});

	it('defaults Celebration Settings storage to 99 when the preference is unset', async () => {
		const storageArea = new FakeChromeLocalStorageArea();
		const preferences = createUserPreferencesStore(storageArea);

		const celebrationStorage = await createCelebrationSettingsStorage(preferences);

		expect(celebrationStorage.getThreshold()).toBe(99);
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
