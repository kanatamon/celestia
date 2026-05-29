import { EyeOutlined, HeartFilled, SettingOutlined } from '@ant-design/icons';
import type { ConnectionState } from '@celestia/tiktok-live-core';
import { type ButtonHTMLAttributes, useState } from 'react';
import { SettingsPopover } from './settings-popover.js';
import styles from './status-bar.module.css';

export interface StatusBarProps {
	connectionState: ConnectionState;
	viewerCount: number;
	likeCount: number;
	username?: string | null;
	onOpenUsernameInput?: () => void;
	onOpenSettings?: () => void;
	onSettingsOpenChange?: (open: boolean) => void;
	isSettingsOpen?: boolean;
}

type BadgeKind = 'discovering' | 'connected' | 'offline' | 'reconnecting' | 'ended';

interface BadgeViewModel {
	label: string;
	kind: BadgeKind;
}

interface SettingsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	isOpen: boolean;
}

export function StatusBar({
	connectionState,
	viewerCount,
	likeCount,
	username,
	onOpenUsernameInput,
	onOpenSettings,
	onSettingsOpenChange,
	isSettingsOpen,
}: StatusBarProps) {
	const [uncontrolledSettingsOpen, setUncontrolledSettingsOpen] = useState(false);
	const isSettingsPopoverOpen = isSettingsOpen ?? uncontrolledSettingsOpen;
	const handleSettingsPopoverOpenChange = (open: boolean) => {
		if (isSettingsOpen === undefined) {
			setUncontrolledSettingsOpen(open);
		}

		onSettingsOpenChange?.(open);

		onOpenSettings?.();
	};
	const settingsControl = (
		<SettingsPopover open={isSettingsPopoverOpen} onOpenChange={handleSettingsPopoverOpenChange}>
			<SettingsButton isOpen={isSettingsPopoverOpen} />
		</SettingsPopover>
	);

	if (connectionState.status === 'idle') {
		return (
			<div className={styles.statusBar} role="status">
				<button className={styles.openButton} type="button" onClick={onOpenUsernameInput}>
					Open Live
				</button>
				{settingsControl}
			</div>
		);
	}

	const badge = toBadgeViewModel(connectionState);
	const displayUsername = username || connectionState.username;

	return (
		<div className={styles.statusBar} role="status">
			<div className={styles.statusCluster} data-celestia-status-cluster>
				<span className={styles.metric}>
					<EyeOutlined aria-hidden="true" />
					{viewerCount.toLocaleString()}
				</span>
				<span className={styles.metric}>
					<HeartFilled aria-hidden="true" />
					{likeCount.toLocaleString()}
				</span>
				<span className={styles.username}>@{displayUsername}</span>
				{badge ? <ConnectionBadge badge={badge} /> : null}
			</div>
			{settingsControl}
		</div>
	);
}

function SettingsButton({
	className,
	isOpen,
	type = 'button',
	...buttonProps
}: SettingsButtonProps) {
	const classNames = joinClassNames(
		styles.settingsButton,
		isOpen ? styles.settingsButtonActive : undefined,
		className,
	);

	return (
		<button
			{...buttonProps}
			aria-label="Open settings"
			aria-pressed={isOpen}
			className={classNames}
			data-celestia-status-settings
			type={type}
		>
			<SettingOutlined aria-hidden="true" />
		</button>
	);
}

function ConnectionBadge({ badge }: { badge: BadgeViewModel }) {
	const classNames = [
		styles.badge,
		styles.signalBars,
		badge.kind === 'discovering' ? styles.badgeDiscovering : undefined,
		badge.kind === 'connected' ? styles.badgeConnected : undefined,
		badge.kind === 'offline' ? styles.badgeOffline : undefined,
		badge.kind === 'reconnecting' ? styles.badgeReconnecting : undefined,
		badge.kind === 'ended' ? styles.badgeEnded : undefined,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<span className={classNames} role="status" aria-label={`Connection state: ${badge.label}`}>
			<span className={styles.bars} aria-hidden="true">
				<i />
				<i />
				<i />
			</span>
			<span className={styles.label}>{badge.label}</span>
		</span>
	);
}

function joinClassNames(...classNames: Array<string | undefined>): string {
	return classNames.filter((className): className is string => Boolean(className)).join(' ');
}

function toBadgeViewModel(state: ConnectionState): BadgeViewModel | undefined {
	switch (state.status) {
		case 'attaching':
		case 'attached':
		case 'connecting':
		case 'detaching':
		case 'disconnecting':
			return { label: 'Discovering', kind: 'discovering' };
		case 'connected':
			return { label: 'Connected', kind: 'connected' };
		case 'error':
			if (state.reason === 'offline') {
				return { label: 'Offline', kind: 'offline' };
			}
			return { label: 'Reconnecting', kind: 'reconnecting' };
		case 'detached':
		case 'disconnected':
			return { label: 'Stream Ended', kind: 'ended' };
		case 'idle':
			return undefined;
	}
}
