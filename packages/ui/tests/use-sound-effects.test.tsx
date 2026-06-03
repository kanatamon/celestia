import type { ChatLiveEvent, GiftLiveEvent, MemberLiveEvent } from '@celestia/tiktok-live-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundManager, useSoundEffects } from '../src/index.js';
import { createStrictRoot } from './render-strict.js';

function SoundEffectsHarness({
	events,
}: {
	events: Array<ChatLiveEvent | GiftLiveEvent | MemberLiveEvent>;
}) {
	useSoundEffects(events);
	return null;
}

describe('useSoundEffects', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('plays sounds for new chat and gift events only', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		render(<SoundEffectsHarness events={[]} />);

		expect(play).not.toHaveBeenCalled();

		render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);

		expect(play).toHaveBeenCalledTimes(1);

		render(
			<SoundEffectsHarness
				events={[chatEvent('chat-1'), memberEvent('member-1'), giftEvent('gift-1')]}
			/>,
		);

		expect(play).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenLastCalledWith('gift');

		unmount();
	});

	it('routes a gift at or above the celebration threshold to the celebration channel', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		render(<SoundEffectsHarness events={[]} />);

		// Default Celebration Threshold is 99. A below-threshold gift keeps the
		// per-gift chime; an at/above-threshold gift plays the fanfare instead.
		render(<SoundEffectsHarness events={[giftEvent('gift-low', 30)]} />);

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('gift');

		render(
			<SoundEffectsHarness events={[giftEvent('gift-low', 30), giftEvent('gift-high', 99)]} />,
		);

		expect(play).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenLastCalledWith('celebration');

		unmount();
	});

	it('does not play sounds for events that already exist on mount', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		render(<SoundEffectsHarness events={[chatEvent('chat-1'), giftEvent('gift-1')]} />);

		expect(play).not.toHaveBeenCalled();

		render(
			<SoundEffectsHarness
				events={[chatEvent('chat-1'), giftEvent('gift-1'), chatEvent('chat-2')]}
			/>,
		);

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		unmount();
	});

	it('resets tracked event ids when the event list is cleared', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const { render, unmount } = createStrictRoot();

		render(<SoundEffectsHarness events={[]} />);

		render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		render(<SoundEffectsHarness events={[]} />);

		render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);

		expect(play).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenLastCalledWith('chat');

		unmount();
	});
});

function chatEvent(id: string): ChatLiveEvent {
	return {
		type: 'chat',
		id,
		ts: 1,
		source: 'test',
		user: {
			userId: 'user-1',
			uniqueId: 'viewer',
			nickname: 'Viewer',
		},
		text: 'hello',
	};
}

function giftEvent(id: string, diamondCount = 1): GiftLiveEvent {
	return {
		type: 'gift',
		id,
		ts: 2,
		source: 'test',
		user: {
			userId: 'user-2',
			uniqueId: 'gifter',
			nickname: 'Gifter',
		},
		giftId: 'rose',
		giftName: 'Rose',
		diamondCount,
		repeatCount: 1,
	};
}

function memberEvent(id: string): MemberLiveEvent {
	return {
		type: 'member',
		id,
		ts: 3,
		source: 'test',
		user: {
			userId: 'user-3',
			uniqueId: 'member',
			nickname: 'Member',
		},
		action: 'join',
	};
}
