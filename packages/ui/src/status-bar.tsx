import { EyeOutlined, HeartFilled, SettingOutlined } from '@ant-design/icons';
import type { ConnectionState } from '@celestia/tiktok-live-core';
import { type ButtonHTMLAttributes, type Ref, useEffect, useRef, useState } from 'react';
import {
	type ConnectionSignalKind,
	type ConnectionSignalViewModel,
	isAdvisoryFaultKind,
	toConnectionSignalViewModel,
} from './connection-advisory.js';
import { ConnectionAdvisory } from './connection-advisory-popover.js';
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
	canClearLiveSessionData?: boolean;
	onClearLiveSessionData?: () => void;
	/**
	 * Re-establishes the live feed when the user clicks Reconnect in the
	 * Connection Advisory. The `ui` package stays Chrome-free; the host (Session
	 * Tab) supplies the actual reload mechanism.
	 */
	onReconnect?: () => void;
	/**
	 * Anchor for the Like Layer's Heart Float target — the Like Counter element
	 * hearts fly to. The Like Layer caches this element's coordinates; it is also
	 * what scale-bumps on a Heart Float arrival (the Like Counter pop).
	 */
	likeCounterRef?: Ref<HTMLSpanElement>;
}

type ActiveConnectionState = ConnectionState & {
	status: Exclude<ConnectionState['status'], 'idle'>;
};

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
	canClearLiveSessionData,
	onClearLiveSessionData,
	onReconnect,
	likeCounterRef,
}: StatusBarProps) {
	const [uncontrolledSettingsOpen, setUncontrolledSettingsOpen] = useState(false);

	// The Connection Advisory auto-opens on entering a fault kind (offline /
	// reconnecting) and auto-closes on recovery (connected / discovering) or end.
	// The per-episode dismiss/latch lifecycle is a follow-up slice; here it is a
	// plain "open while faulting" projection with a manual reopen via the bars.
	const connectionSignal: ConnectionSignalViewModel | undefined = isActiveConnectionState(
		connectionState,
	)
		? toConnectionSignalViewModel(connectionState)
		: undefined;
	const isFaultKind = connectionSignal !== undefined && isAdvisoryFaultKind(connectionSignal.kind);
	const [isAdvisoryOpen, setIsAdvisoryOpen] = useState(false);
	const wasFaultRef = useRef(false);
	useEffect(() => {
		if (isFaultKind && !wasFaultRef.current) {
			setIsAdvisoryOpen(true);
		} else if (!isFaultKind && wasFaultRef.current) {
			setIsAdvisoryOpen(false);
		}
		wasFaultRef.current = isFaultKind;
	}, [isFaultKind]);

	const isSettingsPopoverOpen = isSettingsOpen ?? uncontrolledSettingsOpen;
	const handleSettingsPopoverOpenChange = (open: boolean) => {
		if (isSettingsOpen === undefined) {
			setUncontrolledSettingsOpen(open);
		}

		onSettingsOpenChange?.(open);

		onOpenSettings?.();
	};
	const settingsControl = (
		<SettingsPopover
			canClearLiveSessionData={canClearLiveSessionData}
			onClearLiveSessionData={onClearLiveSessionData}
			open={isSettingsPopoverOpen}
			onOpenChange={handleSettingsPopoverOpenChange}
		>
			<SettingsButton isOpen={isSettingsPopoverOpen} />
		</SettingsPopover>
	);

	if (!isActiveConnectionState(connectionState) || connectionSignal === undefined) {
		return (
			<div className={styles.statusBar} role="status">
				<button className={styles.openButton} type="button" onClick={onOpenUsernameInput}>
					Open Live
				</button>
				{settingsControl}
			</div>
		);
	}

	const displayUsername = username || connectionState.username;

	return (
		<div className={styles.statusBar} role="status">
			<div className={styles.statusCluster} data-celestia-status-cluster>
				<span className={styles.connectionCluster} data-state={connectionSignal.kind}>
					{isFaultKind ? (
						<ConnectionAdvisory
							signal={connectionSignal}
							open={isAdvisoryOpen}
							onOpenChange={setIsAdvisoryOpen}
							onReconnect={onReconnect}
						>
							<ConnectionSignal signal={connectionSignal} />
						</ConnectionAdvisory>
					) : (
						<ConnectionSignal signal={connectionSignal} />
					)}
					<span className={styles.username}>@{displayUsername}</span>
				</span>
				<span className={styles.metric}>
					<EyeOutlined aria-hidden="true" />
					{viewerCount.toLocaleString()}
				</span>
				<span className={styles.metric} data-celestia-like-counter ref={likeCounterRef}>
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
