import { Alert, Flex, Modal, Space, Typography } from 'antd';
import { Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GlassButton } from '~/components/_ui/glass-button';
import { Highlight } from '~/components/_ui/highlight';
import { liveEventClient } from '~/lib/live-event-client';
import { useLiveEventStore } from '~/lib/live-event-store';
import { isConnectionError } from '~/lib/tiktok-live-events';

const { Title, Paragraph } = Typography;

export const LiveConnectionAlert: React.FC<{ username: string }> = ({
	username,
}) => {
	const connection = useLiveEventStore((state) => state.connection);
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
		liveEventClient.retry();
	};

	if (!isConnectionError(connection.status)) {
		return null;
	}

	return (
		<Modal
			open={isModalOpen}
			footer={[
				<GlassButton key="close" onClick={handleClose}>
					Close
				</GlassButton>,
				<GlassButton key="retry" onClick={handleOk}>
					Retry
				</GlassButton>,
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
