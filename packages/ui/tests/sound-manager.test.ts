import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundManager } from '../src/index.js';

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
		localStorage.clear();
		MockAudio.instances = [];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		localStorage.clear();
	});

	it('deduplicates play calls by channel cooldown and applies persisted volume scaling', () => {
		expect(soundManager.getVolume('master')).toBe(100);
		expect(soundManager.getVolume('chat')).toBe(30);
		expect(soundManager.getVolume('gift')).toBe(50);

		soundManager.setVolume('master', 40);
		soundManager.setVolume('chat', 25);
		soundManager.setVolume('gift', 75);

		expect(localStorage.getItem('celestia:volume:master')).toBe('40');
		expect(localStorage.getItem('celestia:volume:chat')).toBe('25');
		expect(localStorage.getItem('celestia:volume:gift')).toBe('75');
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
	});
});
