import { HeartFilled, UserOutlined } from '@ant-design/icons';
import type { ConnectionState, ConnectionStateStatus } from '@celestia/tiktok-live-core';
import styles from './status-bar.module.css';

export interface StatusBarProps {
	connectionState: ConnectionState;
	viewerCount: number;
	likeCount: number;
	username?: string | null;
	onOpenUsernameInput?: () => void;
}

type BadgeKind = 'starting' | 'live' | 'interrupted' | 'ended';

interface BadgeViewModel {
	label: string;
	kind: BadgeKind;
	animated: boolean;
	pulse: boolean;
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

	const badge = toBadgeViewModel(connectionState.status);
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
		badge.animated ? styles.badgeAnimated : undefined,
		badge.kind === 'live' ? styles.badgeLive : undefined,
		badge.kind === 'interrupted' ? styles.badgeInterrupted : undefined,
		badge.kind === 'ended' ? styles.badgeEnded : undefined,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<span className={classNames} role="status" aria-label={`Connection state: ${badge.label}`}>
			{badge.pulse ? <span className={styles.dot} aria-hidden="true" /> : null}
			<span className={styles.label}>{badge.label}</span>
		</span>
	);
}

function toBadgeViewModel(status: ConnectionStateStatus): BadgeViewModel | undefined {
	switch (status) {
		case 'attaching':
		case 'attached':
		case 'connecting':
		case 'detaching':
		case 'disconnecting':
			return { label: 'Starting', kind: 'starting', animated: true, pulse: false };
		case 'connected':
			return { label: 'Live', kind: 'live', animated: true, pulse: true };
		case 'error':
			return { label: 'Interrupted', kind: 'interrupted', animated: false, pulse: false };
		case 'detached':
		case 'disconnected':
			return { label: 'Stream Ended', kind: 'ended', animated: false, pulse: false };
		case 'idle':
			return undefined;
	}
}
