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

type ConnectionSignalKind = 'discovering' | 'connected' | 'offline' | 'reconnecting' | 'ended';
type ActiveConnectionState = ConnectionState & {
	status: Exclude<ConnectionState['status'], 'idle'>;
};

interface ConnectionSignalViewModel {
	label: string;
	kind: ConnectionSignalKind;
}

interface SettingsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	isOpen: boolean;
}

const connectionSignalClassNames: Record<ConnectionSignalKind, string | undefined> = {
	discovering: styles.signalDiscovering,
	connected: styles.signalConnected,
	offline: styles.signalOffline,
	reconnecting: styles.signalReconnecting,
	ended: styles.signalEnded,
};

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

	if (!isActiveConnectionState(connectionState)) {
		return (
			<div className={styles.statusBar} role="status">
				<button className={styles.openButton} type="button" onClick={onOpenUsernameInput}>
					Open Live
				</button>
				{settingsControl}
			</div>
		);
	}

	const connectionSignal = toConnectionSignalViewModel(connectionState);
	const displayUsername = username || connectionState.username;

	return (
		<div className={styles.statusBar} role="status">
			<div className={styles.statusCluster} data-celestia-status-cluster>
				<span className={styles.connectionCluster}>
					<ConnectionSignal signal={connectionSignal} />
					<span className={styles.username}>@{displayUsername}</span>
				</span>
				<span className={styles.metric}>
					<EyeOutlined aria-hidden="true" />
					{viewerCount.toLocaleString()}
				</span>
				<span className={styles.metric}>
					<HeartFilled aria-hidden="true" />
					{likeCount.toLocaleString()}
				</span>
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

function ConnectionSignal({ signal }: { signal: ConnectionSignalViewModel }) {
	const classNames = joinClassNames(styles.signalBars, connectionSignalClassNames[signal.kind]);

	return (
		<span
			className={classNames}
			role="status"
			aria-label={`Connection state: ${signal.label}`}
			data-state={signal.kind}
		>
			<i aria-hidden="true" />
			<i aria-hidden="true" />
			<i aria-hidden="true" />
		</span>
	);
}

function joinClassNames(...classNames: Array<string | undefined>): string {
	return classNames.filter((className): className is string => Boolean(className)).join(' ');
}

function isActiveConnectionState(state: ConnectionState): state is ActiveConnectionState {
	return state.status !== 'idle';
}

function toConnectionSignalViewModel(state: ActiveConnectionState): ConnectionSignalViewModel {
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
	}
}
