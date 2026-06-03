import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	configureSoundManagerStorage,
	createSoundManager,
	soundManager,
	type VolumeKey,
} from '../src/index.js';

class MockAudio {
	static instances: MockAudio[] = [];

	readonly src: string;
	volume = 1;
	play = vi.fn(() => Promise.resolve());

	constructor(src: string) {
		this.src = src;
		MockAudio.instances.push(this);
	}
}

describe('soundManager', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		vi.stubGlobal('Audio', MockAudio);
		configureSoundManagerStorage(createTestSoundManagerStorage());
		MockAudio.instances = [];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('deduplicates play calls by channel cooldown and applies persisted volume scaling', () => {
		expect(soundManager.getVolume('master')).toBe(100);
		expect(soundManager.getVolume('chat')).toBe(30);
		expect(soundManager.getVolume('gift')).toBe(50);
		expect(soundManager.getVolume('celebration')).toBe(70);

		soundManager.setVolume('master', 40);
		soundManager.setVolume('chat', 25);
		soundManager.setVolume('gift', 75);

		expect(soundManager.getVolume('master')).toBe(40);
		expect(soundManager.getVolume('chat')).toBe(25);
		expect(soundManager.getVolume('gift')).toBe(75);

		soundManager.play('chat');
		soundManager.play('chat');
		soundManager.play('gift');

		const chatAudio = MockAudio.instances.find((audio) => audio.src === '/sfx-chat.mp3');
		const giftAudio = MockAudio.instances.find((audio) => audio.src === '/sfx-gift.wav');

		expect(chatAudio).toBeDefined();
		expect(giftAudio).toBeDefined();
		expect(chatAudio?.play).toHaveBeenCalledTimes(1);
		expect(giftAudio?.play).toHaveBeenCalledTimes(1);
		expect(chatAudio?.volume).toBe(0.1);
		expect(giftAudio?.volume).toBeCloseTo(0.3);

		vi.advanceTimersByTime(299);
		soundManager.play('chat');
		expect(chatAudio?.play).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1);
		soundManager.play('chat');
		expect(chatAudio?.play).toHaveBeenCalledTimes(2);

		soundManager.preview('chat');
		soundManager.preview('chat');
		expect(chatAudio?.play).toHaveBeenCalledTimes(4);

		soundManager.preview('gift');
		soundManager.preview('gift');
		expect(giftAudio?.play).toHaveBeenCalledTimes(3);

		soundManager.play('celebration');
		const celebrationAudio = MockAudio.instances.find(
			(audio) => audio.src === '/sfx-celebration.mp3',
		);
		expect(celebrationAudio).toBeDefined();
		expect(celebrationAudio?.play).toHaveBeenCalledTimes(1);
	});

	it('round-trips volumes through injected storage and returns defaults when storage is empty', () => {
		const storedVolumes = new Map<VolumeKey, number>();
		const manager = createSoundManager({
			storage: {
				getVolume: (key) => storedVolumes.get(key),
				setVolume: (key, value) => {
					storedVolumes.set(key, value);
				},
			},
		});

		expect(manager.getVolume('master')).toBe(100);
		expect(manager.getVolume('chat')).toBe(30);
		expect(manager.getVolume('gift')).toBe(50);

		manager.setVolume('master', 40);
		manager.setVolume('chat', 25);
		manager.setVolume('gift', 75);

		expect(storedVolumes).toEqual(
			new Map<VolumeKey, number>([
				['master', 40],
				['chat', 25],
				['gift', 75],
			]),
		);
		expect(manager.getVolume('master')).toBe(40);
		expect(manager.getVolume('chat')).toBe(25);
		expect(manager.getVolume('gift')).toBe(75);
	});
});

function createTestSoundManagerStorage() {
	const storedVolumes = new Map<VolumeKey, number>();

	return {
		getVolume: (key: VolumeKey) => storedVolumes.get(key),
		setVolume: (key: VolumeKey, value: number) => {
			storedVolumes.set(key, value);
		},
	};
}
