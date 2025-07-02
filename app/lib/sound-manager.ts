export class SoundManager {
	private static instances: Map<string, HTMLAudioElement> = new Map();

	static async play(
		soundUrl: string,
		options: { volume?: number; loop?: boolean } = {},
	): Promise<void> {
		const { volume = 0.5, loop = false } = options;

		let audio = this.instances.get(soundUrl);

		if (!audio) {
			audio = new Audio(soundUrl);
			audio.volume = volume;
			audio.loop = loop;
			this.instances.set(soundUrl, audio);
		}

		try {
			audio.currentTime = 0;
			await audio.play();
		} catch (error) {
			console.error('Error playing sound:', error);
		}
	}

	static stop(soundUrl: string): void {
		const audio = this.instances.get(soundUrl);
		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}
	}

	static stopAll(): void {
		this.instances.forEach((audio) => {
			audio.pause();
			audio.currentTime = 0;
		});
	}
}
