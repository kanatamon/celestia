/**
 * Celebration Threshold settings (PRD #66 §E, ADR-0007).
 *
 * The Synthesized Gift Celebration only fires for gifts whose unit `diamondCount`
 * meets a user-configurable **Celebration Threshold**. This module owns the live
 * threshold value the settings slider writes and the trigger reads at evaluation
 * time, so dragging the slider changes which gifts synthesize without a reload.
 *
 * Storage is injectable (mirroring `SoundManagerStorage`): the Session Tab wires
 * a `chrome.storage.local`-backed storage so the threshold persists across
 * reloads and browser restarts. Reads and writes are clamped/normalised here so
 * every consumer sees a value within the valid range.
 */

export const CELEBRATION_THRESHOLD_DEFAULT = 99;
export const CELEBRATION_THRESHOLD_MIN = 30;
export const CELEBRATION_THRESHOLD_MAX = 50000;

export interface CelebrationSettingsStorage {
	getThreshold(): number | null | undefined;
	setThreshold(value: number): void | Promise<void>;
}

export interface CelebrationSettings {
	getThreshold(): number;
	setThreshold(value: number): void;
}

export interface CreateCelebrationSettingsOptions {
	storage?: CelebrationSettingsStorage;
}

class StorageCelebrationSettings implements CelebrationSettings {
	#storage: CelebrationSettingsStorage;

	constructor({
		storage = createMemoryCelebrationSettingsStorage(),
	}: CreateCelebrationSettingsOptions = {}) {
		this.#storage = storage;
	}

	setStorage(storage: CelebrationSettingsStorage): void {
		this.#storage = storage;
	}

	getThreshold(): number {
		return normalizeThreshold(this.#storage.getThreshold());
	}

	setThreshold(value: number): void {
		const normalized = normalizeThreshold(value);
		void this.#storage.setThreshold(normalized);
	}
}

export function normalizeThreshold(value: unknown): number {
	const parsedValue = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return CELEBRATION_THRESHOLD_DEFAULT;
	}

	return Math.min(
		CELEBRATION_THRESHOLD_MAX,
		Math.max(CELEBRATION_THRESHOLD_MIN, Math.round(parsedValue)),
	);
}

function createMemoryCelebrationSettingsStorage(): CelebrationSettingsStorage {
	let value: number | undefined;

	return {
		getThreshold: () => value,
		setThreshold: (next) => {
			value = next;
		},
	};
}

export function createCelebrationSettings(
	options: CreateCelebrationSettingsOptions = {},
): CelebrationSettings {
	return new StorageCelebrationSettings(options);
}

const defaultCelebrationSettings = new StorageCelebrationSettings();

export function configureCelebrationSettingsStorage(storage: CelebrationSettingsStorage): void {
	defaultCelebrationSettings.setStorage(storage);
}

export const celebrationSettings: CelebrationSettings = defaultCelebrationSettings;
