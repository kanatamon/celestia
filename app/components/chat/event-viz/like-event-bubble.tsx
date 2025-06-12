import type { User } from '../types';
import { Avatar } from 'antd';
import { Heart } from 'lucide-react';
import { useTimeout } from '~/lib/use-timeout';

export interface LikeEvent {
	id: string;
	user: User;
	type: 'like';
	timestamp: Date;
	position: number; // For staggered positioning
}

export const LikeEventBubble: React.FC<{
	event: LikeEvent;
	onComplete: (id: string) => void;
	duration?: number;
}> = ({ event, onComplete, duration = 4000 }) => {
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
			style={{
				position: 'absolute',
				right: `${20 + event.position * 15}px`,
				bottom: '20px',
				zIndex: 1000,
				animation: `floatUp ${duration}ms ease-out forwards`,
				animationDelay: `${event.position * 0.2}s`,
			}}
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
						src={event.user.avatar}
						size={44}
						style={{
							border: '2px solid rgba(255, 255, 255, 0.2)',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
						}}
					/>
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
              transform: translateY(0px) scale(0.8);
            }
            15% {
              opacity: 1;
              transform: translateY(-20px) scale(1);
            }
            85% {
              opacity: 1;
              transform: translateY(-150px) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-200px) scale(0.9);
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
