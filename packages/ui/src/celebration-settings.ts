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
 * reloads and browser restarts. Reads and writes snap to the nearest discrete
 * tier so every consumer sees a valid tier value.
 */

/** The discrete tiers the Celebration Threshold can be set to. */
export const CELEBRATION_THRESHOLD_TIERS = [30, 99, 199, 299, 499, 899] as const;

export type CelebrationThresholdTier = (typeof CELEBRATION_THRESHOLD_TIERS)[number];

export const CELEBRATION_THRESHOLD_DEFAULT = 99;

/** @deprecated Use CELEBRATION_THRESHOLD_TIERS. Kept for import compatibility. */
export const CELEBRATION_THRESHOLD_MIN = CELEBRATION_THRESHOLD_TIERS[0];

/** @deprecated Use CELEBRATION_THRESHOLD_TIERS. Kept for import compatibility. */
export const CELEBRATION_THRESHOLD_MAX =
	CELEBRATION_THRESHOLD_TIERS[CELEBRATION_THRESHOLD_TIERS.length - 1];

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

/**
 * Snap `value` to the nearest discrete tier. Returns the default tier when
 * `value` is null, undefined, or not a finite number.
 */
export function normalizeThreshold(value: unknown): number {
	if (value === null || value === undefined) {
		return CELEBRATION_THRESHOLD_DEFAULT;
	}

	const parsedValue = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return CELEBRATION_THRESHOLD_DEFAULT;
	}

	let nearest: number = CELEBRATION_THRESHOLD_TIERS[0];
	let nearestDist = Math.abs(parsedValue - nearest);

	for (const tier of CELEBRATION_THRESHOLD_TIERS) {
		const dist = Math.abs(parsedValue - tier);
		if (dist < nearestDist) {
			nearest = tier;
			nearestDist = dist;
		}
	}

	return nearest;
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
