import { HeartFilled, UserOutlined } from '@ant-design/icons';
import type { ConnectionState } from '@celestia/tiktok-live-core';
import styles from './status-bar.module.css';

export interface StatusBarProps {
	connectionState: ConnectionState;
	viewerCount: number;
	likeCount: number;
	username?: string | null;
	onOpenUsernameInput?: () => void;
}

type BadgeKind = 'discovering' | 'connected' | 'offline' | 'reconnecting' | 'ended';

interface BadgeViewModel {
	label: string;
	kind: BadgeKind;
}

export function StatusBar({
	connectionState,
	viewerCount,
	likeCount,
	username,
	onOpenUsernameInput,
}: StatusBarProps) {
	if (connectionState.status === 'idle') {
		return (
			<div className={styles.statusBar} role="status">
				<button className={styles.openButton} type="button" onClick={onOpenUsernameInput}>
					Open Live
				</button>
			</div>
		);
	}

	const badge = toBadgeViewModel(connectionState);
	const displayUsername = username || connectionState.username;

	return (
		<div className={styles.statusBar} role="status">
			<div className={styles.metricGroup}>
				<span className={styles.metric}>
					<UserOutlined aria-hidden="true" />
					{viewerCount.toLocaleString()}
				</span>
				<span className={styles.metric}>
					<HeartFilled aria-hidden="true" />
					{likeCount.toLocaleString()}
				</span>
			</div>
			<div className={styles.identityGroup}>
				<span className={styles.username}>@{displayUsername}</span>
				{badge ? <ConnectionBadge badge={badge} /> : null}
			</div>
		</div>
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
			if (state.reason === 'interrupted') {
				return { label: 'Interrupted', kind: 'reconnecting' };
			}
			return { label: 'Reconnecting', kind: 'reconnecting' };
		case 'detached':
		case 'disconnected':
			return { label: 'Stream Ended', kind: 'ended' };
		case 'idle':
			return undefined;
	}
}
