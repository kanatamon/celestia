import { CaretRightOutlined } from '@ant-design/icons';
import { Dropdown, Slider } from 'antd';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import styles from './settings-popover.module.css';
import { type Channel, type SoundManager, soundManager, type VolumeKey } from './sound-manager.js';

export interface SettingsPopoverProps {
	children: ReactElement;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	soundManager?: SoundManager;
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
}: SettingsPopoverProps) {
	const [volumes, setVolumes] = useState<VolumeValues>(() => readVolumes(manager));

	useEffect(() => {
		if (open) {
			setVolumes(readVolumes(manager));
		}
	}, [manager, open]);

	const handleVolumeChange = (key: VolumeKey, value: number) => {
		manager.setVolume(key, value);
		setVolumes((currentVolumes) => ({ ...currentVolumes, [key]: value }));
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

function readVolumes(manager: SoundManager): VolumeValues {
	return {
		master: manager.getVolume('master'),
		chat: manager.getVolume('chat'),
		gift: manager.getVolume('gift'),
	};
}
