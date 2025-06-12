import type { Route } from './+types/_tiktok-live-guard';
import { Flex, Modal, Space, Typography } from 'antd';
import { Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Button } from '~/components/_ui/button';
import { Highlight } from '~/components/_ui/highlight';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { useTikTokLiveConnection } from '~/lib/use-tiktok-live-connection';

const { Text, Title } = Typography;

export function clientLoader({ request }: Route.ClientLoaderArgs) {
	const url = new URL(request.url);
	const username = url.searchParams.get('username');
	if (!username) {
		throw new Error(
			'Username is required in the search params. Example: ?username=your_username',
		);
	}
	return {
		username,
	};
}

const TikTokLiveConnectionAlert: React.FC<{ username: string }> = ({
	username,
}) => {
	const connection = useTikTokLiveStore((state) => state.connection);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		if (connection?.status === 'error') {
			showModal();
		}
	}, [connection]);

	const showModal = () => {
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
	};

	const handleOk = () => {
		setIsModalOpen(false);
		window.location.reload();
	};

	if (connection.status !== 'error') {
		return null;
	}

	return (
		<Modal
			open={isModalOpen}
			closable={false}
			styles={{
				content: {
					background:
						'linear-gradient(135deg, rgba(220, 38, 38, 0.75), rgba(185, 28, 28, 0))',
					borderRadius: '12px',
					padding: '6px 8px',
					backdropFilter: 'blur(5px)',
					border: '1px solid rgba(255, 255, 255, 0.1)',
				},
				footer: {
					marginTop: '6px',
				},
			}}
			footer={[
				<Button key="close" onClick={handleClose}>
					Close
				</Button>,
				<Button key="retry" onClick={handleOk}>
					Retry
				</Button>,
			]}
		>
			<Space align="start">
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '36px',
						height: '36px',
						borderRadius: '8px',
						background: 'rgba(255, 255, 255, 0.2)',
						backdropFilter: 'blur(10px)',
					}}
				>
					<Unplug size={20} color="rgba(255, 255, 255, 0.9)" />
				</div>
				<Flex
					vertical
					gap={6}
					style={{
						color: 'rgba(255, 255, 255, 0.95)',
					}}
				>
					<Title
						level={3}
						style={{
							fontSize: '16px',
							margin: 0,
							color: 'currentcolor',
						}}
					>
						Connection Error
					</Title>
					<Text
						style={{
							color: 'currentcolor',
						}}
					>
						Failed to connect to the live stream for{' '}
						<Highlight>@{username}</Highlight>. Please try again later.
					</Text>
				</Flex>
			</Space>
		</Modal>
	);
};

export default function TikTokLiveGuardLayout({
	loaderData: { username },
}: Route.ComponentProps) {
	const { connection } = useTikTokLiveConnection(username);
	return (
		<div
			style={{
				backgroundImage: 'url(/background_starry_sky.png)',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				width: '100%',
				height: '100%',
			}}
		>
			{connection.status === 'connecting' ? (
				<div
					style={{
						display: 'grid',
						placeItems: 'center',
						width: '100%',
						height: '100%',
					}}
				>
					<Text
						style={{
							fontSize: '14px',
							color: 'rgba(255, 255, 255, 0.95)',
							textAlign: 'center',
						}}
					>
						Connecting to <Highlight>@{username}...</Highlight>
					</Text>
				</div>
			) : (
				<Outlet />
			)}
			<TikTokLiveConnectionAlert username={username} />
		</div>
	);
}
