import type { LiveEvent } from '@celestia/tiktok-live-core';
import { useEffect, useRef } from 'react';
import type { Channel, SoundManager } from './sound-manager.js';
import { soundManager } from './sound-manager.js';

type SoundEffectLiveEvent = Pick<LiveEvent, 'id' | 'type'>;

export function useSoundEffects(events: readonly SoundEffectLiveEvent[]): void {
	useSoundEffectsWithManager(events, soundManager);
}

function useSoundEffectsWithManager(
	events: readonly SoundEffectLiveEvent[],
	manager: SoundManager,
): void {
	const seenEventIdsRef = useRef<Set<string> | undefined>(undefined);

	useEffect(() => {
		const seenEventIds = seenEventIdsRef.current;

		if (!seenEventIds) {
			seenEventIdsRef.current = new Set(events.map((event) => event.id));
			return;
		}

		if (events.length === 0) {
			seenEventIds.clear();
			return;
		}

		for (const event of events) {
			if (seenEventIds.has(event.id)) {
				continue;
			}

			seenEventIds.add(event.id);

			if (isSoundChannel(event.type)) {
				manager.play(event.type);
			}
		}
	}, [events, manager]);
}

function isSoundChannel(type: string): type is Channel {
	return type === 'chat' || type === 'gift';
}
