import { Typography } from 'antd';

const { Text } = Typography;

export type ConnectionStatus =
	| 'live'
	| 'connecting'
	| 'reconnecting'
	| 'disconnected'
	| 'ended'
	| 'starting';

interface ConnectionStatusConfig {
	label: string;
	color: string;
	bgColor: string;
	borderColor: string;
	animated?: boolean;
}

export const ConnectionStatusBadge: React.FC<{
	status: ConnectionStatus;
	onClick?: () => void;
}> = ({ status, onClick }) => {
	const statusConfigs: Record<ConnectionStatus, ConnectionStatusConfig> = {
		live: {
			label: 'LIVE',
			color: '#10b981',
			bgColor: 'rgba(16, 185, 129, 0.15)',
			borderColor: 'rgba(16, 185, 129, 0.4)',
			animated: true,
		},
		connecting: {
			label: 'CONNECTING',
			color: '#f59e0b',
			bgColor: 'rgba(245, 158, 11, 0.15)',
			borderColor: 'rgba(245, 158, 11, 0.4)',
			animated: true,
		},
		reconnecting: {
			label: 'RECONNECTING',
			color: '#f97316',
			bgColor: 'rgba(249, 115, 22, 0.15)',
			borderColor: 'rgba(249, 115, 22, 0.4)',
			animated: true,
		},
		disconnected: {
			label: 'DISCONNECTED',
			color: '#ef4444',
			bgColor: 'rgba(239, 68, 68, 0.15)',
			borderColor: 'rgba(239, 68, 68, 0.4)',
		},
		ended: {
			label: 'STREAM ENDED',
			color: '#6b7280',
			bgColor: 'rgba(107, 114, 128, 0.15)',
			borderColor: 'rgba(107, 114, 128, 0.4)',
		},
		starting: {
			label: 'STARTING',
			color: '#3b82f6',
			bgColor: 'rgba(59, 130, 246, 0.15)',
			borderColor: 'rgba(59, 130, 246, 0.4)',
			animated: true,
		},
	};

	const config = statusConfigs[status];

	return (
		<div
			onClick={onClick}
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '2px 8px',
				borderRadius: '100px',
				background: config.bgColor,
				backdropFilter: 'blur(20px)',
				border: `1px solid ${config.borderColor}`,
				boxShadow: `0 4px 24px ${config.bgColor}`,
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			{/* Animated background for live status */}
			{config.animated && (
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: '-100%',
						width: '100%',
						height: '100%',
						background: `linear-gradient(90deg, transparent, ${config.borderColor}, transparent)`,
						animation: 'shimmer 2s infinite',
						// @ts-ignore
						'@keyframes shimmer': {
							'0%': { left: '-100%' },
							'100%': { left: '100%' },
						},
					}}
				/>
			)}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
				}}
			>
				<Text
					style={{
						color: config.color,
						fontSize: '14px',
						fontWeight: '600',
						textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
						letterSpacing: '0.5px',
					}}
				>
					{config.label}
				</Text>
				{status === 'live' && (
					<div
						style={{
							verticalAlign: 'middle',
							display: 'inline-block',
							width: '6px',
							height: '6px',
							borderRadius: '50%',
							background: config.color,
							animation: 'pulse 1.5s infinite',
							boxShadow: `0 0 8px ${config.color}`,
						}}
					/>
				)}
			</div>

			<style>
				{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `}
			</style>
		</div>
	);
};
