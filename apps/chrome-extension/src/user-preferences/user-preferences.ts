/// <reference types="chrome" />

import type { CelebrationSettingsStorage, SoundManagerStorage, VolumeKey } from '@celestia/ui';
// Import the value from the DOM-free module directly, not the barrel: this file
// is reachable from the service worker, and the @celestia/ui barrel pulls in
// CSS-module components whose `document`-based style injection crashes a worker.
import { normalizeThreshold } from '@celestia/ui/celebration-settings';

type VolumePreferenceKey = `volume.${VolumeKey}`;

function volumePreferenceKey(key: VolumeKey): VolumePreferenceKey {
	return `volume.${key}`;
}

const recentStreamerUsernamePreferenceKey = 'recentStreamerUsername';
const traceModePreferenceKey = 'celestia.trace';
const celebrationThresholdPreferenceKey = 'celebration.diamondThreshold';
const volumeKeys = ['master', 'chat', 'gift'] as const satisfies readonly VolumeKey[];
const volumePreferenceKeys = volumeKeys.map(volumePreferenceKey);

export type UserPreferenceKey =
	| typeof recentStreamerUsernamePreferenceKey
	| VolumePreferenceKey
	| typeof traceModePreferenceKey
	| typeof celebrationThresholdPreferenceKey;

type UserPreferenceValues = Partial<Record<UserPreferenceKey, unknown>>;

const userPreferenceKeys = [
	recentStreamerUsernamePreferenceKey,
	...volumePreferenceKeys,
	traceModePreferenceKey,
	celebrationThresholdPreferenceKey,
] as const satisfies readonly UserPreferenceKey[];

interface ChromeLocalStorageArea {
	get(key: UserPreferenceKey): Promise<UserPreferenceValues>;
	set(items: UserPreferenceValues): Promise<void>;
	remove(key: UserPreferenceKey): Promise<void>;
}

export interface UserPreferencesStore {
	getRecentStreamerUsername(): Promise<string | null>;
	setRecentStreamerUsername(username: string | null): Promise<void>;
	getVolume(key: VolumeKey): Promise<number>;
	setVolume(key: VolumeKey, value: number): Promise<void>;
	isTraceModeEnabled(): Promise<boolean>;
	setTraceModeEnabled(enabled: boolean): Promise<void>;
	getCachedTraceModeEnabled(): boolean;
	getCelebrationThreshold(): Promise<number>;
	setCelebrationThreshold(value: number): Promise<void>;
}

const defaultVolumes: Record<VolumeKey, number> = {
	master: 100,
	chat: 30,
	gift: 50,
};

export const userPreferences = createUserPreferencesStore();

export function createUserPreferencesStore(
	storageArea = getChromeLocalStorageArea(),
): UserPreferencesStore {
	let cachedTraceModeEnabled = false;

	return {
		async getRecentStreamerUsername() {
			const value = await getValue(storageArea, recentStreamerUsernamePreferenceKey);
			return typeof value === 'string' && value.trim() ? value : null;
		},
		async setRecentStreamerUsername(username) {
			if (username === null) {
				await storageArea.remove(recentStreamerUsernamePreferenceKey);
				return;
			}

			await storageArea.set({ [recentStreamerUsernamePreferenceKey]: username });
		},
		async getVolume(key) {
			const value = await getValue(storageArea, volumePreferenceKey(key));
			return normalizeVolume(value, defaultVolumes[key]);
		},
		async setVolume(key, value) {
			await storageArea.set({
				[volumePreferenceKey(key)]: normalizeVolume(value, defaultVolumes[key]),
			});
		},
		async isTraceModeEnabled() {
			const value = await getValue(storageArea, traceModePreferenceKey);
			cachedTraceModeEnabled = value === true || value === '1';
			return cachedTraceModeEnabled;
		},
		async setTraceModeEnabled(enabled) {
			cachedTraceModeEnabled = enabled;
			await storageArea.set({ [traceModePreferenceKey]: enabled });
		},
		getCachedTraceModeEnabled() {
			return cachedTraceModeEnabled;
		},
		async getCelebrationThreshold() {
			const value = await getValue(storageArea, celebrationThresholdPreferenceKey);
			return normalizeThreshold(value);
		},
		async setCelebrationThreshold(value) {
			await storageArea.set({
				[celebrationThresholdPreferenceKey]: normalizeThreshold(value),
			});
		},
	};
}

export async function hydrateUserPreferences(
	preferences: UserPreferencesStore = userPreferences,
): Promise<void> {
	await preferences.isTraceModeEnabled();
}

export async function createSoundManagerStorage(
	preferences: UserPreferencesStore = userPreferences,
): Promise<SoundManagerStorage> {
	const volumes = new Map<VolumeKey, number>();
	await Promise.all(
		volumeKeys.map(async (key) => {
			volumes.set(key, await preferences.getVolume(key));
		}),
	);

	return {
		getVolume: (key) => volumes.get(key),
		setVolume: (key, value) => {
			volumes.set(key, value);
			return preferences.setVolume(key, value);
		},
	};
}

/**
 * Hydrates the Celebration Settings live store from the persisted preference,
 * mirroring `createSoundManagerStorage`. The synthesized-celebration trigger
 * reads `getThreshold` synchronously at evaluation time, so the current value
 * is cached here; the settings slider's writes persist through `setThreshold`
 * and update that cache, so dragging the slider changes which gifts synthesize
 * without a reload.
 */
export async function createCelebrationSettingsStorage(
	preferences: UserPreferencesStore = userPreferences,
): Promise<CelebrationSettingsStorage> {
	let threshold = await preferences.getCelebrationThreshold();

	return {
		getThreshold: () => threshold,
		setThreshold: (value) => {
			threshold = value;
			return preferences.setCelebrationThreshold(value);
		},
	};
}

function getChromeLocalStorageArea(): ChromeLocalStorageArea {
	const maybeChrome = typeof chrome === 'undefined' ? undefined : chrome;
	const storageArea = (maybeChrome as { storage?: { local?: ChromeLocalStorageArea } } | undefined)
		?.storage?.local;

	if (!storageArea) {
		return createMemoryChromeLocalStorageArea();
	}

	return storageArea;
}

async function getValue(
	storageArea: ChromeLocalStorageArea,
	key: UserPreferenceKey,
): Promise<unknown> {
	const values = await storageArea.get(key);
	return values[key];
}

function normalizeVolume(value: unknown, fallback: number): number {
	const parsedValue = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return fallback;
	}

	return Math.min(100, Math.max(0, parsedValue));
}

function createMemoryChromeLocalStorageArea(): ChromeLocalStorageArea {
	const values = new Map<UserPreferenceKey, unknown>();

	return {
		async get(key) {
			return { [key]: values.get(key) };
		},
		async set(items) {
			for (const key of userPreferenceKeys) {
				if (Object.hasOwn(items, key)) {
					values.set(key, items[key]);
				}
			}
		},
		async remove(key) {
			values.delete(key);
		},
	};
}
