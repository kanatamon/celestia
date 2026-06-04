import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeartbeatConveyor, type PushLiker } from '../src/heartbeat-conveyor.js';
import type { ConveyorLiker } from '../src/heartbeat-conveyor-motion.js';
import { BEAT_MS } from '../src/heartbeat-conveyor-motion.js';
import { createStrictRoot } from './render-strict.js';

function liker(id: string, extra: Partial<ConveyorLiker> = {}): ConveyorLiker {
	return { id, avatarUrl: `https://cdn/${id}.jpg`, name: id, ...extra };
}

describe('HeartbeatConveyor', () => {
	let push: PushLiker | null = null;

	beforeEach(() => {
		vi.useFakeTimers();
		push = null;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function mount(props: Partial<Parameters<typeof HeartbeatConveyor>[0]> = {}) {
		const root = createStrictRoot();
		root.render(
			<HeartbeatConveyor
				onReady={(p) => {
					push = p;
				}}
				{...props}
			/>,
		);
		return root;
	}

	function tickBeat() {
		act(() => {
			vi.advanceTimersByTime(BEAT_MS);
		});
	}

	function avatars(container: HTMLElement): HTMLImageElement[] {
		return [...container.querySelectorAll('img')] as HTMLImageElement[];
	}

	it('hands the parent a push sink and seats a liker only on the beat', () => {
		const { container, unmount } = mount();
		expect(push).toBeTypeOf('function');

		act(() => {
			push?.(liker('alice'));
		});
		// A like alone seats nobody — the row advances on the beat.
		expect(avatars(container)).toHaveLength(0);

		tickBeat();
		const imgs = avatars(container);
		expect(imgs).toHaveLength(1);
		expect(imgs[0]?.getAttribute('src')).toBe('https://cdn/alice.jpg');
		unmount();
	});

	it('stays calm under a storm: one beat seats only the latest liker', () => {
		const { container, unmount } = mount();
		act(() => {
			for (const id of ['a', 'b', 'c']) push?.(liker(id));
		});
		tickBeat();
		const imgs = avatars(container);
		expect(imgs).toHaveLength(1);
		expect(imgs[0]?.getAttribute('src')).toBe('https://cdn/c.jpg');
		unmount();
	});

	it('alternates the breathe token on every repeat-liker beat, uncapped', () => {
		const { container, unmount } = mount();

		function seat(): HTMLElement | null {
			return container.querySelector<HTMLElement>('[data-celestia-heartbeat-conveyor] > span');
		}

		// First seating: no breathe (plain enter) until the liker repeats.
		act(() => push?.(liker('a')));
		tickBeat();
		expect(seat()?.getAttribute('data-breathe')).toBeNull();

		// Each subsequent like by the seated liker flips the token a <-> b, so the
		// one-shot keyframe restarts every time — past the old 10-bump cap too.
		const tokens: (string | null)[] = [];
		for (let i = 0; i < 12; i += 1) {
			act(() => push?.(liker('a')));
			tickBeat();
			tokens.push(seat()?.getAttribute('data-breathe') ?? null);
		}
		expect(tokens).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
		unmount();
	});

	it('falls back to an initial when avatarUrl is missing', () => {
		const { container, unmount } = mount();
		act(() => {
			push?.(liker('bob', { avatarUrl: undefined, name: 'Bob' }));
		});
		tickBeat();
		expect(avatars(container)).toHaveLength(0);
		const fallback = container.querySelector('[data-conveyor-fallback]');
		expect(fallback?.textContent).toBe('B');
		unmount();
	});

	it('falls back to the initial when the avatar image errors', () => {
		const { container, unmount } = mount();
		act(() => {
			push?.(liker('carol', { name: 'Carol' }));
		});
		tickBeat();
		const img = avatars(container)[0];
		expect(img).toBeTruthy();
		act(() => {
			img?.dispatchEvent(new Event('error'));
		});
		// After the error the broken <img> is replaced by an initial fallback.
		expect(avatars(container)).toHaveLength(0);
		expect(container.querySelector('[data-conveyor-fallback]')?.textContent).toBe('C');
		unmount();
	});

	it('renders a non-interactive, aria-hidden layer', () => {
		const { container, unmount } = mount();
		const row = container.querySelector('[data-celestia-heartbeat-conveyor]');
		expect(row?.getAttribute('aria-hidden')).toBe('true');
		unmount();
	});

	it('clears seats when the reset key changes', () => {
		const { container, render, unmount } = mount() as ReturnType<typeof createStrictRoot>;
		act(() => {
			push?.(liker('a'));
		});
		tickBeat();
		expect(avatars(container)).toHaveLength(1);

		render(
			<HeartbeatConveyor
				onReady={(p) => {
					push = p;
				}}
				resetKey={1}
			/>,
		);
		expect(avatars(container)).toHaveLength(0);
		unmount();
	});
});
