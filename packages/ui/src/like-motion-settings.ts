/**
 * Reduced Like Motion settings (PRD #79, issue #83).
 *
 * The **Reduced Like Motion** User Preference and its live value. When on, the
 * Like Layer drops its decorative motion — no **Heart Float**, no **Like Counter
 * pop**, and the **Heartbeat Conveyor** cross-fades faces instead of sliding —
 * while the like **count** and the liker **faces** always remain (CONTEXT.md,
 * ADR-0008). Only decoration is removed, never information.
 *
 * This toggle is the **sole source of truth**: the OS `prefers-reduced-motion`
 * setting is never consulted (PRD #79, Out of Scope).
 *
 * Storage is injectable, mirroring `CelebrationSettings`/`SoundManagerStorage`:
 * the Session Tab wires a `chrome.storage.local`-backed storage so the preference
 * persists across Live Sessions and browser restarts. The settings popover writes
 * it; the StatusBar, Heart Float, and Conveyor read the live value, so flipping
 * the toggle takes effect without a reload. Default is **off** (full motion).
 */

export const REDUCED_LIKE_MOTION_DEFAULT = false;

export interface LikeMotionSettingsStorage {
	getReducedMotion(): boolean | null | undefined;
	setReducedMotion(value: boolean): void | Promise<void>;
}

export interface LikeMotionSettings {
	getReducedMotion(): boolean;
	setReducedMotion(value: boolean): void;
}

export interface CreateLikeMotionSettingsOptions {
	storage?: LikeMotionSettingsStorage;
}

class StorageLikeMotionSettings implements LikeMotionSettings {
	#storage: LikeMotionSettingsStorage;

	constructor({
		storage = createMemoryLikeMotionSettingsStorage(),
	}: CreateLikeMotionSettingsOptions = {}) {
		this.#storage = storage;
	}

	setStorage(storage: LikeMotionSettingsStorage): void {
		this.#storage = storage;
	}

	getReducedMotion(): boolean {
		return normalizeReducedMotion(this.#storage.getReducedMotion());
	}

	setReducedMotion(value: boolean): void {
		const normalized = normalizeReducedMotion(value);
		void this.#storage.setReducedMotion(normalized);
	}
}

/** Coerce any stored value to a boolean; unset/invalid falls back to the default (off). */
export function normalizeReducedMotion(value: unknown): boolean {
	if (value === null || value === undefined) {
		return REDUCED_LIKE_MOTION_DEFAULT;
	}
	return value === true || value === 'true' || value === 1 || value === '1';
}

function createMemoryLikeMotionSettingsStorage(): LikeMotionSettingsStorage {
	let value: boolean | undefined;

	return {
		getReducedMotion: () => value,
		setReducedMotion: (next) => {
			value = next;
		},
	};
}

export function createLikeMotionSettings(
	options: CreateLikeMotionSettingsOptions = {},
): LikeMotionSettings {
	return new StorageLikeMotionSettings(options);
}

const defaultLikeMotionSettings = new StorageLikeMotionSettings();

export function configureLikeMotionSettingsStorage(storage: LikeMotionSettingsStorage): void {
	defaultLikeMotionSettings.setStorage(storage);
}

export const likeMotionSettings: LikeMotionSettings = defaultLikeMotionSettings;
