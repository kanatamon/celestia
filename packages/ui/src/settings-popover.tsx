import { CaretRightOutlined } from '@ant-design/icons';
import { Dropdown, Slider } from 'antd';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import {
	CELEBRATION_THRESHOLD_MAX,
	CELEBRATION_THRESHOLD_MIN,
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

export function SettingsPopover({
	children,
	open,
	onOpenChange,
	soundManager: manager = soundManager,
	celebrationSettings: celebration = celebrationSettings,
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

	return (
		<Dropdown
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
					<div className={styles.title}>CELEBRATION</div>
					<div className={styles.rows}>
						<ThresholdSliderRow onThresholdChange={handleThresholdChange} value={threshold} />
					</div>
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

function ThresholdSliderRow({ onThresholdChange, value }: ThresholdSliderRowProps) {
	return (
		<div className={styles.row}>
			<span className={styles.label}>Threshold</span>
			<Slider
				ariaLabelForHandle="Celebration diamond threshold"
				className={styles.slider}
				max={CELEBRATION_THRESHOLD_MAX}
				min={CELEBRATION_THRESHOLD_MIN}
				onChange={onThresholdChange}
				step={1}
				tooltip={{ formatter: null }}
				value={value}
			/>
			<span className={styles.percentage}>{Math.round(value)}</span>
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
