import type { LiveStatus } from '~/components/_ui/live-status-badge';
import type { LiveStreamConnection } from '~/lib/tiktok-live-store';
import { LiveStatusBadge } from '~/components/_ui/live-status-badge';
import { tikTokLiveClient } from '~/lib/tiktok-live-client';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

const getLiveStatus = (connection: LiveStreamConnection): LiveStatus => {
	if (connection.status === 'live') {
		return 'live';
	}
	if (connection.status === 'connected') {
		return 'starting';
	}
	if (connection.status === 'connecting') {
		return 'connecting';
	}
	if (connection.status === 'reconnecting') {
		return 'reconnecting';
	}
	if (
		connection.status === 'disconnected' &&
		connection.reason === 'Stream ended'
	) {
		return 'ended';
	}
	return 'disconnected';
};

export const TikTokLiveStatusBadge = () => {
	const connection = useTikTokLiveStore((state) => state.connection);
	const status = getLiveStatus(connection);
	return (
		<LiveStatusBadge
			status={status}
			onClick={() => {
				if (connection.status === 'disconnected') {
					tikTokLiveClient.retry();
				}
			}}
		/>
	);
};
