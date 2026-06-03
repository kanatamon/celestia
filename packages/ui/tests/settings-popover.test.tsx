import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CelebrationSettings, StatusBar, soundManager, type VolumeKey } from '../src/index.js';
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
		// Three volume sliders plus the Celebration Threshold slider.
		expect(container.querySelectorAll('input[type="range"]')).toHaveLength(4);
		expect(container.querySelectorAll('button[aria-label="Play test sound"]')).toHaveLength(2);

		const chatSlider = getSlider(container, 'Chat volume');
		await act(async () => {
			chatSlider.value = '42';
			chatSlider.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(setVolume).toHaveBeenCalledWith('chat', 42);
		expect(container.textContent).toContain('42%');

		const [chatPreview, giftPreview] = getTestSoundButtons(container);

		await act(async () => {
			chatPreview.click();
			giftPreview.click();
		});

		expect(preview).toHaveBeenCalledWith('chat');
		expect(preview).toHaveBeenCalledWith('gift');

		await act(async () => {
			gearButton.click();
		});

		expect(container.textContent).not.toContain('SOUND SETTINGS');
		expect(gearButton.getAttribute('aria-pressed')).toBe('false');

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

		// The slider value is the tier index (0–4), not the raw diamond count.
		// 299 is tier index 3.
		const thresholdSlider = getSlider(container, 'Celebration diamond threshold');
		expect(thresholdSlider.value).toBe('3');

		// Dragging to index 4 maps to tier 999.
		await act(async () => {
			thresholdSlider.value = '4';
			thresholdSlider.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(celebrationSettings.setThreshold).toHaveBeenCalledWith(999);

		unmount();
	});
});

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

function getTestSoundButtons(container: Element): [HTMLButtonElement, HTMLButtonElement] {
	const buttons = Array.from(
		container.querySelectorAll<HTMLButtonElement>('button[aria-label="Play test sound"]'),
	);
	const [chatButton, giftButton] = buttons;

	if (buttons.length !== 2 || !chatButton || !giftButton) {
		throw new Error('Expected chat and gift test sound buttons.');
	}

	return [chatButton, giftButton];
}
