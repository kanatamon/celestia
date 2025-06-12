import type { ChatEvent } from '~/components/chat/types';
import { Flex, Space, Typography } from 'antd';
import { FollowerEventCard } from '~/components/chat/event-viz/follow-event-card';
import { GiftEventCard } from '~/components/chat/event-viz/gift-event-card';
import { MessageEventCard } from '~/components/chat/event-viz/message-event-card';
import { ShareEventComponent } from '~/components/chat/event-viz/share-event-card';
import { NewUserJoinEventCard } from './new-user-join-even-card';
import { TikTokLiveStatusBadge } from './tiktok-live-status-badge';
import { TikTokLiveViewerCounter } from './tiktok-live-viewer-counter';

const { Title } = Typography;

export const ChatFeed: React.FC = () => {
	// Sample data
	const chatEvents: ChatEvent[] = [
		{
			type: 'message',
			id: '1',
			user: {
				id: 'user1',
				name: 'MysticOracle',
				avatar:
					'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50&h=50&fit=crop&crop=face',
			},
			message: 'Thank you for the roses!.',
			timestamp: new Date(),
			gifts: [
				{
					name: 'Rose',
					count: 1,
					image:
						'https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png',
				},
				{
					name: 'Crystal Ball',
					count: 5,
					image:
						'https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.png',
				},
			],
		},
		{
			type: 'follower',
			id: '2',
			user: {
				id: 'user2',
				name: 'CrystalGazer',
				avatar:
					'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
			},
			timestamp: new Date(),
		},
		{
			type: 'message',
			id: '3',
			user: {
				id: 'user3',
				name: 'MoonChild',
				avatar:
					'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
			},
			message:
				"I'm currently in marketing but thinking of switching to web design. What do you see?",
			timestamp: new Date(),
			gifts: [],
		},
		{
			type: 'message',
			id: '4',
			user: {
				id: 'user2',
				name: 'CrystalGazer',
				avatar:
					'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
			},
			message: '@MoonChild your question is so good!',
			timestamp: new Date(),
			gifts: [],
		},
		{
			type: 'gift',
			id: '5',
			user: {
				id: 'user4',
				name: 'StarSeeker',
				avatar:
					'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=50&h=50&fit=crop&crop=face',
			},
			gift: {
				id: 'gift1',
				name: 'Crystal Ball',
				cost: 100,
				image:
					'https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.png',
				repeat: 8,
			},
			timestamp: new Date(),
		},
		{
			type: 'gift',
			id: '51',
			user: {
				id: 'user4',
				name: 'StarSeeker',
				avatar:
					'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=50&h=50&fit=crop&crop=face',
			},
			gift: {
				id: 'gift1',
				name: 'Crystal Ball',
				cost: 100,
				image:
					'https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.png',
				repeat: 8,
			},
			timestamp: new Date(),
		},
		{
			type: 'share',
			id: '6',
			user: {
				id: 'user5',
				name: 'CosmicVibes',
				avatar:
					'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=face',
			},
			timestamp: new Date(),
		},
	];

	const renderEvent = (event: ChatEvent) => {
		switch (event.type) {
			case 'message':
				return <MessageEventCard key={event.id} event={event} />;
			case 'follower':
				return <FollowerEventCard key={event.id} event={event} />;
			case 'share':
				return <ShareEventComponent key={event.id} event={event} />;
			case 'gift':
				return <GiftEventCard key={event.id} event={event} />;
			default:
				return null;
		}
	};

	return (
		<Flex
			vertical
			style={{
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			{/* Subtle gradient overlay for depth */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					// background:
					// 	'linear-gradient(135deg, rgba(167, 139, 250, 0.03) 0%, rgba(236, 72, 153, 0.03) 50%, rgba(59, 130, 246, 0.03) 100%)',
					pointerEvents: 'none',
					borderRadius: '24px',
				}}
			/>

			<Flex
				style={{
					width: '100%',
					marginBottom: '8px',
					// borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
					position: 'relative',
					zIndex: 1,
				}}
				justify="space-between"
				align="baseline"
			>
				<Title
					level={2}
					style={{
						color: 'rgba(255, 255, 255, 0.95)',
						fontSize: '20px',
						paddingBottom: '8px',
						margin: 0,
						textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
						background: 'linear-gradient(45deg, #ffffff, #a78bfa)',
						backgroundClip: 'text',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
					}}
				>
					Messages
				</Title>
				<Space align="center">
					<TikTokLiveViewerCounter />
					<TikTokLiveStatusBadge />
				</Space>
			</Flex>
			<Flex
				flex={1}
				style={{
					maxHeight: '100%',
					overflowY: 'auto',
					paddingRight: '8px',
					position: 'relative',
					zIndex: 1,
					scrollbarWidth: 'thin',
					scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
				}}
				vertical
				align="start"
				gap={8}
			>
				<style>
					{`
            div::-webkit-scrollbar {
              width: 6px;
            }
            div::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.05);
              border-radius: 3px;
            }
            div::-webkit-scrollbar-thumb {
              background: linear-gradient(45deg, rgba(167, 139, 250, 0.5), rgba(236, 72, 153, 0.5));
              border-radius: 3px;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(45deg, rgba(167, 139, 250, 0.7), rgba(236, 72, 153, 0.7));
            }
          `}
				</style>
				{chatEvents.map(renderEvent)}
			</Flex>
			<NewUserJoinEventCard
				style={{
					width: '100%',
					marginTop: '8px',
				}}
			/>
		</Flex>
	);
};
