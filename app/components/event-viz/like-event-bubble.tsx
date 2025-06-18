import type { LiveLikeMessage } from '~/lib/live-event/live-event-store';
import { Avatar } from 'antd';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useTimeout } from '~/lib/use-timeout';

const randomPosition = (min: number, max: number) => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const LikeEventBubble: React.FC<{
	event: LiveLikeMessage;
	onComplete: (id: string) => void;
	duration?: number;
	positionRange?: [number, number];
}> = ({ positionRange = [0, 50], event, onComplete, duration = 4000 }) => {
	const [position] = useState(() =>
		randomPosition(positionRange[0], positionRange[1]),
	);

	useTimeout(() => {
		onComplete(event.id);
	}, duration);

	const config = {
		icon: <Heart />,
		color: '#f87171',
		bgColor: 'rgba(239, 68, 68, 0.2)',
		borderColor: 'rgba(239, 68, 68, 0.4)',
	};

	return (
		<div
			style={
				{
					'--position': `${position}px`,
					position: 'absolute',
					zIndex: 1000,
					animation: `floatUp ${duration}ms ease-out forwards`,
					willChange: 'transform, opacity',
				} as React.CSSProperties
			}
		>
			<div
				style={{
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: '6px',
				}}
			>
				{/* Profile Avatar */}
				<div
					style={{
						borderRadius: '50%',
						padding: '3px',
						background: `linear-gradient(45deg, ${config.borderColor}, rgba(255, 255, 255, 0.3))`,
						animation: 'profilePulse 2s ease-in-out infinite',
					}}
				>
					<Avatar
						src={event.userDetails.profilePictureUrls?.at(-1)}
						size={44}
						style={{
							border: '2px solid rgba(255, 255, 255, 0.2)',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
						}}
					>
						{event.nickname?.charAt(0).toUpperCase() || '?'}
					</Avatar>
				</div>

				{/* Event Icon */}
				<div
					style={{
						padding: '6px',
						borderRadius: '50%',
						background: config.bgColor,
						backdropFilter: 'blur(10px)',
						border: `1px solid ${config.borderColor}`,
						color: config.color,
						fontSize: '12px',
						boxShadow: `0 2px 8px ${config.bgColor}`,
						animation: 'iconBounce 0.6s ease-out',
					}}
				>
					{config.icon}
				</div>
			</div>

			<style>
				{`
          @keyframes floatUp {
            0% {
              opacity: 0;
              transform: translateX(var(--position)) translateY(0px) scale(0);
            }
            25% {
              opacity: 1;
              transform: translateX(var(--position)) translateY(-100px) scale(1);
            }
            85% {
              opacity: 1;
              transform: translateX(var(--position)) translateY(-250px) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateX(var(--position)) translateY(-300px) scale(0.9);
            }
          }

          @keyframes profilePulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.1);
            }
          }

          @keyframes iconBounce {
            0% {
              transform: scale(0);
            }
            60% {
              transform: scale(1.2);
            }
            100% {
              transform: scale(1);
            }
          }
        `}
			</style>
		</div>
	);
};
