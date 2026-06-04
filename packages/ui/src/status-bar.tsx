import { EyeOutlined, HeartFilled, SettingOutlined } from '@ant-design/icons';
import type { ConnectionState } from '@celestia/tiktok-live-core';
import {
	type ButtonHTMLAttributes,
	type Ref,
	useEffect,
	useReducer,
	useRef,
	useState,
} from 'react';
import { initialAdvisoryOpenState, reduceAdvisoryOpenState } from './advisory-open-state.js';
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
	 * Re-opens the live in the existing paired tab when the user clicks Reopen live
	 * in the Connection Advisory's `off-live` branch. The `ui` package stays
	 * Chrome-free; the host (Session Tab) supplies the navigation.
	 */
	onReopenLive?: () => void;
	/**
	 * Suppresses the Connection Advisory's auto-open while the host (Session Tab) is
	 * silently retrying a `reconnecting` fault via Auto-Reconnect (ADR-0009). The
	 * "Reconnecting" signal bars still show; only the popover is held back. When the
	 * host clears this on exhaustion, the still-present fault opens the advisory.
	 */
	suppressAdvisory?: boolean;
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
	/**
	 * Fired when the Reduced Like Motion toggle in the settings popover changes, so
	 * the host can re-render the Like Layer with the new value. The popover persists
	 * the preference itself (via `likeMotionSettings`); this only mirrors the live
	 * value up to the host React tree.
	 */
	onReducedLikeMotionChange?: (reducedMotion: boolean) => void;
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
	onReopenLive,
	suppressAdvisory = false,
	likeCounterRef,
	heartArrivalSignal = 0,
	onReducedLikeMotionChange,
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

	// The Connection Advisory's open state is governed by a pure per-episode
	// reducer (advisory-open-state.ts): a fault auto-opens it once per episode, a
	// dismiss latches it shut for the rest of that episode (no re-nag), the bars
	// reopen it on demand, and recovery/end closes it. Here we only translate the
	// fault-kind edge into faultEntered/recovered events and route the popover's
	// open-change into dismissed/reopened — the latch logic lives in the reducer.
	const connectionSignal: ConnectionSignalViewModel | undefined = isActiveConnectionState(
		connectionState,
	)
		? toConnectionSignalViewModel(connectionState)
		: undefined;
	const isFaultKind = connectionSignal !== undefined && isAdvisoryFaultKind(connectionSignal.kind);
	const [advisory, dispatchAdvisory] = useReducer(
		reduceAdvisoryOpenState,
		initialAdvisoryOpenState,
	);
	const isAdvisoryOpen = advisory.open;
	useEffect(() => {
		// A suppressed fault edge starts no episode (Auto-Reconnect is retrying); when
		// `suppressAdvisory` later clears while still faulting, this effect re-runs and
		// re-fires the edge un-suppressed, opening the advisory on exhaustion.
		if (isFaultKind) {
			dispatchAdvisory({ kind: 'faultEntered', suppressed: suppressAdvisory });
		} else {
			dispatchAdvisory({ kind: 'recovered' });
		}
	}, [isFaultKind, suppressAdvisory]);
	// AntD reports open=false on click-away / clicking the open bars (a dismiss),
	// and open=true when the bars are clicked while closed (a manual reopen).
	const handleAdvisoryOpenChange = (open: boolean) => {
		dispatchAdvisory({ kind: open ? 'reopened' : 'dismissed' });
	};

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
			onReducedLikeMotionChange={onReducedLikeMotionChange}
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

	// Signal bars + streamer name. For fault kinds this whole group is the
	// advisory's clickable trigger (a button, so the hit target spans the cluster
	// rather than the tiny bars, with a hover affordance); otherwise it is inert.
	const clusterContent = (
		<>
			<ConnectionSignal signal={connectionSignal} />
			<span className={styles.username}>@{displayUsername}</span>
		</>
	);

	return (
		<div className={styles.statusBar} role="status">
			<div className={styles.statusCluster} data-celestia-status-cluster>
				<span className={styles.connectionCluster} data-state={connectionSignal.kind}>
					{isFaultKind ? (
						<ConnectionAdvisory
							signal={connectionSignal}
							open={isAdvisoryOpen}
							onOpenChange={handleAdvisoryOpenChange}
							onReconnect={onReconnect}
							onReopenLive={onReopenLive}
						>
							<button
								aria-label={`${connectionSignal.label} — show connection advisory`}
								className={styles.clusterTrigger}
								data-celestia-connection-cluster-trigger
								data-open={isAdvisoryOpen ? 'true' : undefined}
								type="button"
							>
								{clusterContent}
							</button>
						</ConnectionAdvisory>
					) : (
						clusterContent
					)}
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
