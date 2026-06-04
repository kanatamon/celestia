import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	type CelebrationSettings,
	type LikeMotionSettings,
	StatusBar,
	soundManager,
	type VolumeKey,
} from '../src/index.js';
import { SettingsPopover } from '../src/settings-popover.js';
import { createStrictRoot } from './render-strict.js';

vi.mock('antd', async (importOriginal) => {
	const actual = await importOriginal<typeof import('antd')>();
	const React = await import('react');

	function Dropdown({
		children,
		open,
		onOpenChange,
		placement,
		popupRender,
		trigger,
	}: {
		children: ReactElement<{ onClick?: () => void }>;
		open?: boolean;
		onOpenChange?: (open: boolean, info: { source: 'trigger' }) => void;
		placement?: string;
		popupRender?: (originNode: ReactNode) => ReactNode;
		trigger?: string[];
	}) {
		const child = React.cloneElement(children, {
			onClick: () => onOpenChange?.(!open, { source: 'trigger' }),
		});

		return React.createElement(
			'div',
			{
				'data-dropdown-placement': placement,
				'data-dropdown-trigger': trigger?.join(','),
			},
			child,
			open ? popupRender?.(null) : null,
		);
	}

	function Slider({
		ariaLabelForHandle,
		max,
		min,
		onChange,
		value,
	}: {
		ariaLabelForHandle?: string;
		max?: number;
		min?: number;
		onChange?: (value: number) => void;
		value?: number;
	}) {
		const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
			onChange?.(Number(event.currentTarget.value));

		// Forward min/max so jsdom's range input does not clamp values (the
		// Celebration Threshold ranges up to 50000) to the default 0–100.
		return React.createElement('input', {
			'aria-label': ariaLabelForHandle,
			max,
			min,
			onChange: handleChange,
			onInput: handleChange,
			type: 'range',
			value,
		});
	}

	return { ...actual, Dropdown, Slider };
});

describe('SettingsPopover', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('opens from the StatusBar gear, updates volumes, and previews channel sounds', async () => {
		const preview = vi.spyOn(soundManager, 'preview').mockImplementation(() => {});
		const setVolume = vi.spyOn(soundManager, 'setVolume').mockImplementation(() => {});
		const initialVolumes: Record<VolumeKey, number> = {
			master: 100,
			chat: 30,
			gift: 50,
			celebration: 70,
		};

		vi.spyOn(soundManager, 'getVolume').mockImplementation((key) => {
			return initialVolumes[key];
		});

		const { container, render, unmount } = createStrictRoot();

		render(<ControlledStatusBar />);

		const gearButton = getButton(container, 'Open settings');
		expect(container.textContent).not.toContain('SOUND SETTINGS');
		expect(gearButton.getAttribute('aria-pressed')).toBe('false');

		await act(async () => {
			gearButton.click();
		});

		expect(container.textContent).toContain('SOUND SETTINGS');
		expect(gearButton.getAttribute('aria-pressed')).toBe('true');
		expect(
			container.querySelector('[data-dropdown-placement]')?.getAttribute('data-dropdown-placement'),
		).toBe('bottomRight');
		expect(
			container.querySelector('[data-dropdown-trigger]')?.getAttribute('data-dropdown-trigger'),
		).toBe('click');
		expect(container.textContent).toContain('100%');
		expect(container.textContent).toContain('30%');
		expect(container.textContent).toContain('50%');
		expect(container.textContent).toContain('70%');
		expect(getButton(container, 'Clear Live Session Data').disabled).toBe(true);
		// Master/Chat/Gift plus the Celebration volume slider and the Celebration
		// Threshold slider.
		expect(container.querySelectorAll('input[type="range"]')).toHaveLength(5);
		expect(container.querySelectorAll('button[aria-label="Play test sound"]')).toHaveLength(3);

		const chatSlider = getSlider(container, 'Chat volume');
		await act(async () => {
			chatSlider.value = '42';
			chatSlider.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(setVolume).toHaveBeenCalledWith('chat', 42);
		expect(container.textContent).toContain('42%');

		const [chatPreview, giftPreview, celebrationPreview] = getTestSoundButtons(container);

		await act(async () => {
			chatPreview.click();
			giftPreview.click();
			celebrationPreview.click();
		});

		expect(preview).toHaveBeenCalledWith('chat');
		expect(preview).toHaveBeenCalledWith('gift');
		expect(preview).toHaveBeenCalledWith('celebration');

		await act(async () => {
			gearButton.click();
		});

		expect(container.textContent).not.toContain('SOUND SETTINGS');
		expect(gearButton.getAttribute('aria-pressed')).toBe('false');

		unmount();
	});

	it('closes the settings popover and requests confirmation for Live Session data cleanup', async () => {
		const onOpenChange = vi.fn();
		const onClearLiveSessionData = vi.fn();
		const { container, render, unmount } = createStrictRoot();

		render(
			<SettingsPopover
				canClearLiveSessionData
				open
				onClearLiveSessionData={onClearLiveSessionData}
				onOpenChange={onOpenChange}
			>
				<button type="button">settings</button>
			</SettingsPopover>,
		);

		const clearButton = getButton(container, 'Clear Live Session Data');
		expect(clearButton.disabled).toBe(false);

		await act(async () => {
			clearButton.click();
		});

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onClearLiveSessionData).toHaveBeenCalledTimes(1);

		unmount();
	});

	it('reads the stored Celebration Threshold and persists slider changes', async () => {
		// stored = 299 (tier index 3); the slider reflects the index on open.
		let stored = 299;
		const celebrationSettings: CelebrationSettings = {
			getThreshold: () => stored,
			setThreshold: vi.fn((value) => {
				stored = value;
			}),
		};

		const { container, render, unmount } = createStrictRoot();

		render(
			<SettingsPopover open onOpenChange={() => {}} celebrationSettings={celebrationSettings}>
				<button type="button">settings</button>
			</SettingsPopover>,
		);

		// The slider value is the tier index (0–5), not the raw diamond count.
		// Tiers are [30, 99, 199, 299, 499, 899], so 299 is tier index 3.
		const thresholdSlider = getSlider(container, 'Celebration diamond threshold');
		expect(thresholdSlider.value).toBe('3');

		// Dragging to index 5 maps to tier 899.
		await act(async () => {
			thresholdSlider.value = '5';
			thresholdSlider.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(celebrationSettings.setThreshold).toHaveBeenCalledWith(899);

		unmount();
	});

	it('reads the stored Reduced Like Motion preference and persists toggle changes', async () => {
		let stored = false;
		const onReducedLikeMotionChange = vi.fn();
		const likeMotionSettings: LikeMotionSettings = {
			getReducedMotion: () => stored,
			setReducedMotion: vi.fn((value) => {
				stored = value;
			}),
		};

		const { container, render, unmount } = createStrictRoot();

		render(
			<SettingsPopover
				open
				onOpenChange={() => {}}
				likeMotionSettings={likeMotionSettings}
				onReducedLikeMotionChange={onReducedLikeMotionChange}
			>
				<button type="button">settings</button>
			</SettingsPopover>,
		);

		expect(container.textContent).toContain('Reduced Like Motion');
		const toggle = getSwitch(container, 'Reduced Like Motion');
		// Default off (full motion).
		expect(toggle.getAttribute('aria-checked')).toBe('false');

		await act(async () => {
			toggle.click();
		});

		// Persists the preference and mirrors the live value up to the host.
		expect(likeMotionSettings.setReducedMotion).toHaveBeenCalledWith(true);
		expect(onReducedLikeMotionChange).toHaveBeenCalledWith(true);
		expect(stored).toBe(true);

		unmount();
	});
});

function getSwitch(container: Element, label: string): HTMLButtonElement {
	const element = container.querySelector(`button[aria-label="${label}"]`);

	if (!(element instanceof HTMLButtonElement)) {
		throw new Error(`Expected switch with label "${label}".`);
	}

	return element;
}

function ControlledStatusBar() {
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

	return (
		<StatusBar
			connectionState={{ status: 'connected', username: 'celestia' }}
			isSettingsOpen={isSettingsOpen}
			likeCount={2}
			onSettingsOpenChange={setIsSettingsOpen}
			username="celestia"
			viewerCount={1}
		/>
	);
}

function getButton(container: Element, label: string): HTMLButtonElement {
	const element = container.querySelector(`button[aria-label="${label}"]`);

	if (!(element instanceof HTMLButtonElement)) {
		throw new Error(`Expected button with label "${label}".`);
	}

	return element;
}

function getSlider(container: Element, label: string): HTMLInputElement {
	const element = container.querySelector(`input[aria-label="${label}"]`);

	if (!(element instanceof HTMLInputElement)) {
		throw new Error(`Expected slider with label "${label}".`);
	}

	return element;
}

function getTestSoundButtons(
	container: Element,
): [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement] {
	const buttons = Array.from(
		container.querySelectorAll<HTMLButtonElement>('button[aria-label="Play test sound"]'),
	);
	const [chatButton, giftButton, celebrationButton] = buttons;

	if (buttons.length !== 3 || !chatButton || !giftButton || !celebrationButton) {
		throw new Error('Expected chat, gift, and celebration test sound buttons.');
	}

	return [chatButton, giftButton, celebrationButton];
}
