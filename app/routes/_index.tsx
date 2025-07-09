import type { Route } from './+types/_index';
import { Button, Input } from 'antd';
import { Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { Form, useNavigate } from 'react-router';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Celestia' },
		{ name: 'description', content: 'Welcome to Celestia' },
	];
}

const DreamyUsernameForm: React.FC = () => {
	const [username, setUsername] = useState<string>('');
	const [isFocused, setIsFocused] = useState<boolean>(false);
	const navigate = useNavigate();

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setUsername(e.target.value);
	};

	const handleFocus = (): void => {
		setIsFocused(true);
	};

	const handleBlur = (): void => {
		setIsFocused(false);
	};

	const glowStyle: React.CSSProperties = {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderRadius: '16px',
		background:
			'linear-gradient(90deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
		filter: 'blur(20px)',
		zIndex: -1,
	};

	const sparkleStyle = (position: {
		top?: string;
		bottom?: string;
		left?: string;
		right?: string;
	}): React.CSSProperties => ({
		position: 'absolute',
		fontSize: '16px',
		animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
		...position,
	});

	return (
		<div>
			{/* CSS Animations */}
			<style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes floatDelayed {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        input::placeholder {
          color: #ddd6fe;
          opacity: 0.8;
        }

        button:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 12px 35px rgba(139, 92, 246, 0.25) !important;
        }

        button:active {
          transform: scale(0.95) !important;
        }
      `}</style>

			{/* Input container */}
			<div
				style={{
					position: 'relative',
				}}
			>
				<form
					style={{
						position: 'relative',
						transition: 'transform 0.3s ease',
						transform: isFocused ? 'scale(1.05)' : 'scale(1)',
						display: 'flex',
						gap: '8px',
						alignItems: 'center',
					}}
					onSubmit={(e) => {
						e.preventDefault();
						const preferredUsername = username.replace('@', '').trim();
						if (preferredUsername) {
							navigate(`/live/${preferredUsername}/feed`, {
								replace: true,
							});
						}
					}}
				>
					<Input
						name="username"
						placeholder="TikTok username..."
						variant="underlined"
						value={username}
						onChange={handleInputChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						size="large"
						style={{
							width: '100%',
							padding: '6px 16px',
							borderRadius: '99px',
							background: isFocused
								? 'rgba(255, 255, 255, 0.3)'
								: 'rgba(255, 255, 255, 0.2)',
							backdropFilter: 'blur(10px)',
							border: isFocused
								? '2px solid #f9a8d4'
								: '2px solid rgba(196, 181, 253, 0.5)',
							color: 'white',
							outline: 'none',
							transition: 'all 0.3s ease',
							boxShadow: isFocused
								? '0 8px 25px rgba(236, 72, 153, 0.25)'
								: 'none',
						}}
					/>

					<Button
						htmlType="submit"
						type="primary"
						shape="circle"
						icon={<Sparkles />}
						style={{
							backgroundImage:
								'linear-gradient(90deg,  #a18cd1, #fbc2eb, #fad0c4, #ff9a9e)',
							backgroundSize: '200% 200%',
							animation: 'gradientAnimation 3s ease infinite',
							border: 'none',
							color: 'white',
						}}
						size="large"
					/>

					{/* Input glow effect */}
					{isFocused && <div style={glowStyle}></div>}
				</form>

				{/* Sparkle effects on focus */}
				{isFocused && (
					<>
						<div style={sparkleStyle({ top: '-8px', right: '-8px' })}>✨</div>
						<div
							style={{
								...sparkleStyle({ bottom: '-8px', left: '-8px' }),
								animationDelay: '0.75s',
							}}
						>
							💫
						</div>
						<div
							style={{
								...sparkleStyle({
									top: '50%',
									right: '-16px',
								}),
								transform: 'translateY(-50%)',
								animationDelay: '1.5s',
							}}
						>
							⭐
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default function IndexRoute() {
	return (
		<div
			style={{
				backgroundImage: 'url(/background_pink_sky.webp)',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				width: '100%',
				height: '100%',
				display: 'grid',
				placeItems: 'center',
			}}
		>
			<DreamyUsernameForm />
		</div>
	);
}
