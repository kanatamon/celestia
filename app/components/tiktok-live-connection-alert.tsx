import { Alert, Flex, Modal, Space, Typography } from 'antd';
import { Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/_ui/button';
import { Highlight } from '~/components/_ui/highlight';
import { tikTokLiveClient } from '~/lib/tiktok-live-client';
import { isConnectionError } from '~/lib/tiktok-live-events';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

const { Title, Paragraph } = Typography;

export const TikTokLiveConnectionAlert: React.FC<{ username: string }> = ({
	username,
}) => {
	const connection = useTikTokLiveStore((state) => state.connection);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		if (isConnectionError(connection.status)) {
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
		tikTokLiveClient.retry();
	};

	if (!isConnectionError(connection.status)) {
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
					{/* TODO: Write better UX message for each error */}
					<Paragraph
						style={{
							color: 'currentcolor',
							margin: 0,
						}}
					>
						Failed to connect to the live stream for{' '}
						<Highlight>@{username}</Highlight>. Please try again later.
					</Paragraph>
					<Alert
						style={{
							background:
								'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))',
							backdropFilter: 'blur(10px)',
							borderRadius: '8px',
							padding: '12px',
							color: 'rgba(255, 255, 255, 0.95)',
							border: 0,
						}}
						message={connection.message || connection.status}
						type="error"
					/>
				</Flex>
			</Space>
		</Modal>
	);
};
