import type { LiveStatus } from '~/components/_ui/live-status-badge';
import type { LiveStreamConnection } from '~/lib/tiktok-live-store';
import { LiveStatusBadge } from '~/components/_ui/live-status-badge';
import { tikTokLiveClient } from '~/lib/tiktok-live-client';
import { isConnectionError } from '~/lib/tiktok-live-events';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

const getLiveStatus = (connection: LiveStreamConnection): LiveStatus => {
	if (connection.status === 'tiktok:live_active') {
		return 'live';
	}
	if (connection.status === 'tiktok:room_found') {
		return 'starting';
	}
	if (connection.status === 'tiktok:authenticating') {
		return 'starting';
	}
	if (connection.status === 'connecting') {
		return 'connecting';
	}
	if (connection.status === 'reconnecting') {
		return 'reconnecting';
	}
	if (connection.status === 'tiktok:stream_ended') {
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
				if (isConnectionError(connection.status)) {
					tikTokLiveClient.retry();
				}
			}}
		/>
	);
};
