import { CaretRightOutlined } from '@ant-design/icons';
import { Dropdown, Slider } from 'antd';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import {
	CELEBRATION_THRESHOLD_TIERS,
	type CelebrationSettings,
	celebrationSettings,
} from './celebration-settings.js';
import styles from './settings-popover.module.css';
import { type Channel, type SoundManager, soundManager, type VolumeKey } from './sound-manager.js';

export interface SettingsPopoverProps {
	children: ReactElement;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	soundManager?: SoundManager;
	celebrationSettings?: CelebrationSettings;
	canClearLiveSessionData?: boolean;
	onClearLiveSessionData?: () => void;
}

type VolumeValues = Record<VolumeKey, number>;

interface VolumeRow {
	key: VolumeKey;
	label: string;
	previewChannel?: Channel;
}

const volumeRows: VolumeRow[] = [
	{ key: 'master', label: 'Master' },
	{ key: 'chat', label: 'Chat', previewChannel: 'chat' },
	{ key: 'gift', label: 'Gift', previewChannel: 'gift' },
];

/**
 * antd Slider with step={null} snaps the handle to the nearest mark key.
 * The keys are 0–4 (equidistant); tier values are stored separately so the
 * slider always moves in equal visual steps regardless of numeric gaps between
 * tiers (1, 30, 99, 299, 999).
 */
const TIER_INDEX_TO_VALUE: Record<number, number> = Object.fromEntries(
	CELEBRATION_THRESHOLD_TIERS.map((tier, i) => [i, tier]),
);
const TIER_VALUE_TO_INDEX: Record<number, number> = Object.fromEntries(
	CELEBRATION_THRESHOLD_TIERS.map((tier, i) => [tier, i]),
);
const SLIDER_MAX = CELEBRATION_THRESHOLD_TIERS.length - 1;

export function SettingsPopover({
	children,
	open,
	onOpenChange,
	soundManager: manager = soundManager,
	celebrationSettings: celebration = celebrationSettings,
	canClearLiveSessionData = false,
	onClearLiveSessionData,
}: SettingsPopoverProps) {
	const [volumes, setVolumes] = useState<VolumeValues>(() => readVolumes(manager));
	const [threshold, setThreshold] = useState<number>(() => celebration.getThreshold());

	useEffect(() => {
		if (open) {
			setVolumes(readVolumes(manager));
			setThreshold(celebration.getThreshold());
		}
	}, [manager, celebration, open]);

	const handleVolumeChange = (key: VolumeKey, value: number) => {
		manager.setVolume(key, value);
		setVolumes((currentVolumes) => ({ ...currentVolumes, [key]: value }));
	};

	const handleThresholdChange = (value: number) => {
		celebration.setThreshold(value);
		setThreshold(value);
	};

	const handleClearLiveSessionData = () => {
		if (!canClearLiveSessionData) return;
		onOpenChange(false);
		onClearLiveSessionData?.();
	};

	return (
		<Dropdown
			destroyOnHidden
			open={open}
			onOpenChange={onOpenChange}
			placement="bottomRight"
			popupRender={() => (
				<div className={styles.popover} data-celestia-settings-popover>
					<div className={styles.title}>SOUND SETTINGS</div>
					<div className={styles.rows}>
						{volumeRows.map(({ key, label, previewChannel }) => (
							<VolumeSliderRow
								key={key}
								label={label}
								onVolumeChange={(value) => handleVolumeChange(key, value)}
								onPreview={previewChannel ? () => manager.preview(previewChannel) : undefined}
								value={volumes[key]}
							/>
						))}
					</div>
					<div className={`${styles.title} ${styles.giftCelebrationTitle}`}>GIFT CELEBRATION</div>
					<div className={styles.rows}>
						<ThresholdSliderRow onThresholdChange={handleThresholdChange} value={threshold} />
					</div>
					<div className={`${styles.title} ${styles.liveSessionTitle}`}>LIVE SESSION</div>
					<button
						aria-label="Clear Live Session Data"
						className={styles.dangerButton}
						disabled={!canClearLiveSessionData}
						onClick={handleClearLiveSessionData}
						type="button"
					>
						Clear Live Session Data
					</button>
				</div>
			)}
			trigger={['click']}
		>
			{children}
		</Dropdown>
	);
}

interface VolumeSliderRowProps {
	label: string;
	onVolumeChange: (value: number) => void;
	onPreview?: () => void;
	value: number;
}

function VolumeSliderRow({ label, onVolumeChange, onPreview, value }: VolumeSliderRowProps) {
	return (
		<div className={styles.row}>
			<span className={styles.label}>{label}</span>
			<Slider
				ariaLabelForHandle={`${label} volume`}
				className={styles.slider}
				max={100}
				min={0}
				onChange={onVolumeChange}
				step={1}
				tooltip={{ formatter: null }}
				value={value}
			/>
			<span className={styles.percentage}>{Math.round(value)}%</span>
			{onPreview ? (
				<button
					aria-label="Play test sound"
					className={styles.testButton}
					onClick={onPreview}
					title="Play test sound"
					type="button"
				>
					<CaretRightOutlined aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}

interface ThresholdSliderRowProps {
	onThresholdChange: (value: number) => void;
	value: number;
}

/** Build antd Slider marks; the active tier is highlighted cyan. */
function buildThresholdMarks(activeValue: number) {
	return Object.fromEntries(
		[...CELEBRATION_THRESHOLD_TIERS.entries()].map(([i, tier]) => {
			const isActive = tier === activeValue;
			return [
				i,
				{
					label: (
						<span
							style={{
								color: isActive ? '#54edff' : 'rgba(248,250,252,0.55)',
								fontWeight: isActive ? 700 : 400,
								fontSize: 10,
							}}
						>
							{tier}
						</span>
					),
				},
			];
		}),
	);
}

function ThresholdSliderRow({ onThresholdChange, value }: ThresholdSliderRowProps) {
	const sliderIndex = TIER_VALUE_TO_INDEX[value] ?? 2; // default to middle (99)

	const handleChange = (index: number) => {
		const tier = TIER_INDEX_TO_VALUE[index];
		if (tier !== undefined) {
			onThresholdChange(tier);
		}
	};

	return (
		<div className={styles.thresholdRow}>
			<span className={styles.label}>Min</span>
			<Slider
				ariaLabelForHandle="Celebration diamond threshold"
				className={styles.thresholdSlider}
				max={SLIDER_MAX}
				min={0}
				marks={buildThresholdMarks(value)}
				onChange={handleChange}
				step={null}
				tooltip={{ formatter: null }}
				value={sliderIndex}
			/>
		</div>
	);
}

function readVolumes(manager: SoundManager): VolumeValues {
	return {
		master: manager.getVolume('master'),
		chat: manager.getVolume('chat'),
		gift: manager.getVolume('gift'),
	};
}
