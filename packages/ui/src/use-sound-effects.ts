import type { LiveEvent } from '@celestia/tiktok-live-core';
import { useEffect, useRef } from 'react';
import { type CelebrationSettings, celebrationSettings } from './celebration-settings.js';
import type { Channel, SoundManager } from './sound-manager.js';
import { soundManager } from './sound-manager.js';

// `diamondCount` lives only on a gift event (the per-unit gift tier). It is
// optional here so the same projection accepts chat events, which carry none.
type SoundEffectLiveEvent = Pick<LiveEvent, 'id' | 'type'> & {
	diamondCount?: number;
};

export function useSoundEffects(events: readonly SoundEffectLiveEvent[]): void {
	useSoundEffectsWithManager(events, soundManager, celebrationSettings);
}

function useSoundEffectsWithManager(
	events: readonly SoundEffectLiveEvent[],
	manager: SoundManager,
	settings: CelebrationSettings,
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

		// Read the Celebration Threshold live, so a slider change re-routes the
		// next qualifying gift without a reload (mirrors the synthesized trigger).
		const threshold = settings.getThreshold();

		for (const event of events) {
			if (seenEventIds.has(event.id)) {
				continue;
			}

			seenEventIds.add(event.id);

			const channel = resolveChannel(event, threshold);
			if (channel) {
				manager.play(channel);
			}
		}
	}, [events, manager, settings]);
}

/**
 * Map a live event to the sound channel it plays on. A gift at or above the
 * Celebration Threshold plays the celebration fanfare *instead of* the per-gift
 * chime — each gift resolves to exactly one channel, so the fanfare replaces the
 * chime for that event rather than layering on top of it. A gift with no
 * diamond value is treated as below any threshold and keeps the plain chime.
 */
function resolveChannel(event: SoundEffectLiveEvent, threshold: number): Channel | undefined {
	if (event.type === 'chat') {
		return 'chat';
	}

	if (event.type === 'gift') {
		return (event.diamondCount ?? 0) >= threshold ? 'celebration' : 'gift';
	}

	return undefined;
}
