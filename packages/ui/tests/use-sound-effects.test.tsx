import type { ChatLiveEvent, GiftLiveEvent, MemberLiveEvent } from '@celestia/tiktok-live-core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundManager, useSoundEffects } from '../src/index.js';

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<SoundEffectsHarness events={[]} />);
		});

		expect(play).not.toHaveBeenCalled();

		act(() => {
			root.render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);
		});

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		act(() => {
			root.render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);
		});

		expect(play).toHaveBeenCalledTimes(1);

		act(() => {
			root.render(
				<SoundEffectsHarness
					events={[chatEvent('chat-1'), memberEvent('member-1'), giftEvent('gift-1')]}
				/>,
			);
		});

		expect(play).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenLastCalledWith('gift');

		act(() => {
			root.unmount();
		});
	});

	it('does not play sounds for events that already exist on mount', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<SoundEffectsHarness events={[chatEvent('chat-1'), giftEvent('gift-1')]} />);
		});

		expect(play).not.toHaveBeenCalled();

		act(() => {
			root.render(
				<SoundEffectsHarness
					events={[chatEvent('chat-1'), giftEvent('gift-1'), chatEvent('chat-2')]}
				/>,
			);
		});

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		act(() => {
			root.unmount();
		});
	});

	it('resets tracked event ids when the event list is cleared', () => {
		const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
		const container = document.createElement('div');
		const root = createRoot(container);

		act(() => {
			root.render(<SoundEffectsHarness events={[]} />);
		});

		act(() => {
			root.render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);
		});

		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenLastCalledWith('chat');

		act(() => {
			root.render(<SoundEffectsHarness events={[]} />);
		});

		act(() => {
			root.render(<SoundEffectsHarness events={[chatEvent('chat-1')]} />);
		});

		expect(play).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenLastCalledWith('chat');

		act(() => {
			root.unmount();
		});
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

function giftEvent(id: string): GiftLiveEvent {
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
		diamondCount: 1,
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
