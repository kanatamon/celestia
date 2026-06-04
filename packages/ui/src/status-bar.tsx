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
	/**
	 * Monotonically increasing on each Heart Float arrival. The Like Layer signals
	 * an arrival (`onHeartArrived`); the host bumps this and the StatusBar owns the
	 * pop — the canvas only signals. The displayed `likeCount` keeps updating
	 * immediately from the store regardless of this; only the scale-bump is gated
	 * to arrival, so under a storm the pop throttles to the arrival rate while the
	 * number sprints.
	 */
	heartArrivalSignal?: number;
}

/** How long the Like Counter pop lasts; matches the keyframe in the CSS module. */
const LIKE_POP_MS = 260;

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
	heartArrivalSignal = 0,
}: StatusBarProps) {
	const [uncontrolledSettingsOpen, setUncontrolledSettingsOpen] = useState(false);

	// The Like Counter pop, driven by `heartArrivalSignal` advancing on each Heart
	// Float arrival. `isPopping` latches the scale-bump class for one animation
	// cycle and re-arms on each fresh arrival, so a sustained burst pulses at the
	// arrival rate. `popNonce` advances per arrival and keys the animated heart so
	// React remounts it — restarting the CSS keyframe mid-pop without a "flush off
	// then on" dance, so a burst re-fires the bump.
	const [isPopping, setIsPopping] = useState(false);
	const [popNonce, setPopNonce] = useState(0);
	const lastArrivalRef = useRef(heartArrivalSignal);
	const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (heartArrivalSignal === lastArrivalRef.current) return;
		lastArrivalRef.current = heartArrivalSignal;
		setIsPopping(true);
		setPopNonce((n) => n + 1);
		if (popTimerRef.current !== null) clearTimeout(popTimerRef.current);
		popTimerRef.current = setTimeout(() => setIsPopping(false), LIKE_POP_MS);
	}, [heartArrivalSignal]);
	useEffect(
		() => () => {
			if (popTimerRef.current !== null) clearTimeout(popTimerRef.current);
		},
		[],
	);

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
				<span
					className={styles.metric}
					data-celestia-like-counter
					data-popping={isPopping ? 'true' : undefined}
					ref={likeCounterRef}
				>
					{/* Keyed by `popNonce` to remount and restart the keyframe per arrival. */}
					<HeartFilled
						key={popNonce}
						aria-hidden="true"
						className={isPopping ? styles.likeCounterPop : undefined}
					/>
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
