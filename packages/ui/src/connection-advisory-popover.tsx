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
	/** Invoked by the Reconnect action, where the fault offers one. */
	onReconnect?: () => void;
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
}: ConnectionAdvisoryProps) {
	const content = resolveConnectionAdvisoryContent(signal.reason);

	return (
		<Dropdown
			destroyOnHidden
			open={open}
			onOpenChange={onOpenChange}
			placement="bottomLeft"
			popupRender={() => (
				<AdvisoryContent content={content} onReconnect={onReconnect} onOpenChange={onOpenChange} />
			)}
			trigger={['click']}
		>
			{children}
		</Dropdown>
	);
}

function AdvisoryContent({
	content,
	onReconnect,
	onOpenChange,
}: {
	content: ConnectionAdvisoryContent;
	onReconnect?: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	const handleReconnect = () => {
		onOpenChange(false);
		onReconnect?.();
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
					onClick={handleReconnect}
					type="button"
				>
					{content.actionLabel}
				</button>
			) : null}
		</div>
	);
}
