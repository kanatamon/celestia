import { Dropdown } from 'antd';
import type { ReactElement } from 'react';
import {
	type ConnectionAdvisoryContent,
	type ConnectionSignalViewModel,
	resolveConnectionAdvisoryContent,
} from './connection-advisory.js';
import styles from './connection-advisory-popover.module.css';

export interface ConnectionAdvisoryProps {
	/** The anchor/trigger element — the ConnectionSignal bars. */
	children: ReactElement;
	/** The current signal view-model; the advisory branches on its `reason`. */
	signal: ConnectionSignalViewModel;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Invoked by the Reconnect action (the `interrupted`/`stale` faults). */
	onReconnect?: () => void;
	/**
	 * Invoked by the Reopen-live action (the `off-live` fault) — navigates the
	 * existing paired tab back to this session's streamer. Parallel to
	 * `onReconnect`; the `ui` package stays Chrome-free and the host supplies the
	 * actual navigation.
	 */
	onReopenLive?: () => void;
}

/**
 * The **Connection Advisory** popover. Built on an AntD {@link Dropdown} used
 * purely for positioning/portal/trigger, with fully custom dark-themed content
 * and a per-state colour accent — mirroring the {@link SettingsPopover}
 * convention. Presentational and Chrome-free: the actual reconnect mechanism is
 * supplied by the host via `onReconnect`.
 */
export function ConnectionAdvisory({
	children,
	signal,
	open,
	onOpenChange,
	onReconnect,
	onReopenLive,
}: ConnectionAdvisoryProps) {
	const content = resolveConnectionAdvisoryContent(signal.reason);
	const accentClassName = content.accent === 'red' ? styles.accentRed : styles.accentAmber;
	// The action button routes by reason: `off-live` reopens the live in the same
	// tab; every other actionable fault reconnects. Kept here (not in the pure
	// content resolver) so the `ui` package stays Chrome-free — the host supplies
	// both callbacks.
	const onAction = signal.reason === 'off-live' ? onReopenLive : onReconnect;

	return (
		<Dropdown
			arrow
			destroyOnHidden
			open={open}
			onOpenChange={onOpenChange}
			placement="bottomLeft"
			popupRender={() => (
				<AdvisoryContent content={content} onAction={onAction} onOpenChange={onOpenChange} />
			)}
			rootClassName={`${styles.popoverRoot} ${accentClassName}`}
			trigger={['click']}
		>
			{children}
		</Dropdown>
	);
}

function AdvisoryContent({
	content,
	onAction,
	onOpenChange,
}: {
	content: ConnectionAdvisoryContent;
	onAction?: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	const handleAction = () => {
		onOpenChange(false);
		onAction?.();
	};

	return (
		<div
			className={styles.advisory}
			data-accent={content.accent}
			data-celestia-connection-advisory
			role="alert"
		>
			<div className={styles.header}>
				<span className={styles.accentDot} aria-hidden="true" />
				<p className={styles.title}>{content.title}</p>
			</div>
			<p className={styles.why}>{content.why}</p>
			<p className={styles.workaround}>{content.workaround}</p>
			{content.secondary ? <p className={styles.secondary}>{content.secondary}</p> : null}
			{content.actionLabel ? (
				<button
					aria-label={content.actionLabel}
					className={styles.actionButton}
					onClick={handleAction}
					type="button"
				>
					{content.actionLabel}
				</button>
			) : null}
		</div>
	);
}
