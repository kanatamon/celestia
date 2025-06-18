import { Flex, Image, Space, Typography } from 'antd';
import { Gift } from 'lucide-react';
import React from 'react';
import { useGiftCounts } from '~/lib/live-event/use-gift-counts';

const { Text } = Typography;

export const EarningGiftsParadeEventCard: React.FC = () => {
	const giftCounts = useGiftCounts();
	return (
		<div
			style={{
				background:
					'linear-gradient(135deg, rgba(255, 215, 0, 0.75), rgba(255, 223, 0, 0))',
				padding: '6px 8px',
				borderRadius: '12px',
			}}
		>
			<Flex gap={10} align="center">
				<Flex
					justify="center"
					align="center"
					style={{
						width: '36px',
						height: '36px',
						borderRadius: '8px',
						background: 'rgba(255, 215, 0, 0.2)',
						backdropFilter: 'blur(20px)',
						border: '1px solid rgba(255, 215, 0, 0.3)',
					}}
				>
					<Gift
						size={20}
						style={{
							color: '#FFD700',
						}}
					/>
				</Flex>
				<div
					style={
						{
							display: 'flex',
							whiteSpace: 'nowrap',
							padding: '2px 8px',
							overflow: 'hidden',
							'--gap': '1rem',
							position: 'relative',
							userSelect: 'none',
							gap: 'var(--gap)',
							width: '100%',
						} as React.CSSProperties
					}
				>
					<div
						style={{
							width: '100%',
							animation: 'scroll 15s linear infinite',
							display: 'flex',
							willChange: 'transform',
						}}
					>
						<div
							style={{
								display: 'flex',
								flex: '0 0 100%',
								width: '100%',
								flexShrink: 0,
								minWidth: '100%',
							}}
						>
							<style>
								{`
								@keyframes scroll {
									from {
										transform: translateX(calc(100% + var(--gap) + 300px));
									}

									to {
										transform: translateX(calc(-100% - var(--gap)));
									}
								}
								`}
							</style>
							<Space size={16}>
								{giftCounts.map((gift) => (
									<Space key={gift.id} size={2} align="center">
										<Image
											src={gift.giftDetails.giftPictureUrl}
											width={24}
											alt={gift.giftDetails.giftName}
										/>
										<Space
											size={2}
											align="baseline"
											style={{
												fontStyle: 'italic',
												color: 'rgba(255, 223, 0, 0.95)',
												fontWeight: 'bold',
												textShadow: '0 0 8px rgba(255, 223, 0, 0.8)',
											}}
										>
											<Text
												style={{
													color: 'currentcolor',
													fontSize: '14px',
												}}
											>
												x
											</Text>
											<Text
												style={{
													color: 'currentcolor',
													fontSize: '20px',
												}}
											>
												{gift.count}
											</Text>
										</Space>
									</Space>
								))}
							</Space>
						</div>
					</div>
				</div>
			</Flex>
		</div>
	);
};
