export type Channel = 'chat' | 'gift' | 'celebration';
export type VolumeKey = 'master' | Channel;

export interface SoundManager {
	play(channel: Channel): void;
	preview(channel: Channel): void;
	setVolume(key: VolumeKey, value: number): void;
	getVolume(key: VolumeKey): number;
}

export interface SoundManagerStorage {
	getVolume(key: VolumeKey): number | null | undefined;
	setVolume(key: VolumeKey, value: number): void | Promise<void>;
}

export interface CreateSoundManagerOptions {
	storage?: SoundManagerStorage;
}

const cooldownMs = 300;
const audioSources: Record<Channel, string> = {
	chat: '/sfx-chat.mp3',
	gift: '/sfx-gift.wav',
	celebration: '/sfx-celebration.mp3',
};
const defaultVolumes: Record<VolumeKey, number> = {
	master: 100,
	chat: 30,
	gift: 50,
	celebration: 70,
};

class BrowserSoundManager implements SoundManager {
	readonly #audioByChannel = new Map<Channel, HTMLAudioElement>();
	readonly #lastPlayedAt = new Map<Channel, number>();
	#storage: SoundManagerStorage;

	constructor({ storage = createMemorySoundManagerStorage() }: CreateSoundManagerOptions = {}) {
		this.#storage = storage;
	}

	setStorage(storage: SoundManagerStorage): void {
		this.#storage = storage;
	}

	play(channel: Channel): void {
		const now = Date.now();
		const lastPlayedAt = this.#lastPlayedAt.get(channel) ?? Number.NEGATIVE_INFINITY;

		if (now - lastPlayedAt < cooldownMs) {
			return;
		}

		this.#lastPlayedAt.set(channel, now);
		this.#playNow(channel);
	}

	preview(channel: Channel): void {
		this.#playNow(channel);
	}

	setVolume(key: VolumeKey, value: number): void {
		void this.#storage.setVolume(key, normalizeVolume(value));
	}

	getVolume(key: VolumeKey): number {
		const storedValue = this.#storage.getVolume(key);
		const parsedValue =
			storedValue === null || storedValue === undefined ? NaN : Number(storedValue);

		if (!Number.isFinite(parsedValue)) {
			return defaultVolumes[key];
		}

		return normalizeVolume(parsedValue);
	}

	#getAudio(channel: Channel): HTMLAudioElement | undefined {
		if (!globalThis.Audio) {
			return undefined;
		}

		const existingAudio = this.#audioByChannel.get(channel);

		if (existingAudio) {
			return existingAudio;
		}

		const audio = new Audio(audioSources[channel]);
		this.#audioByChannel.set(channel, audio);
		return audio;
	}

	#playNow(channel: Channel): void {
		const audio = this.#getAudio(channel);

		if (!audio) {
			return;
		}

		audio.volume = (this.getVolume('master') / 100) * (this.getVolume(channel) / 100);

		try {
			audio.currentTime = 0;
		} catch {
			// Some browser media elements are not seekable until metadata has loaded.
		}

		void audio.play()?.catch(() => undefined);
	}
}

function normalizeVolume(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(100, Math.max(0, value));
}

function createMemorySoundManagerStorage(): SoundManagerStorage {
	const volumes = new Map<VolumeKey, number>();

	return {
		getVolume: (key) => volumes.get(key),
		setVolume: (key, value) => {
			volumes.set(key, value);
		},
	};
}

export function createSoundManager(options: CreateSoundManagerOptions = {}): SoundManager {
	return new BrowserSoundManager(options);
}

const defaultSoundManager = new BrowserSoundManager();

export function configureSoundManagerStorage(storage: SoundManagerStorage): void {
	defaultSoundManager.setStorage(storage);
}

export const soundManager: SoundManager = defaultSoundManager;
