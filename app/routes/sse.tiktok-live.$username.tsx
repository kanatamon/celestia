import type { Route } from './+types/sse.tiktok-live.$username';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { requireEnv } from '~/lib/env-utils.server';
import { eventStream } from '~/lib/event-stream.sever';
import { TikTokLiveEventSender } from '~/lib/tiktok-live-events';

function humanizeTikTokError(error: unknown) {
	if (!(error instanceof Error)) {
		return String(error);
	}
	if (error.message === 'LIVE has ended') {
		return 'LIVE has ended';
	}
	return error.message;
}

export async function loader({
	request,
	params: { username },
}: Route.LoaderArgs) {
	const sessionId = requireEnv('SESSION_ID');
	return eventStream(request.signal, (send) => {
		const server = new TikTokLiveEventSender(send);
		const connection = new WebcastPushConnection(username, {
			sessionId,
		});
		server.send('connection', {
			status: 'tiktok:authenticating',
		});
		connection
			.connect()
			.then((state) => {
				if (state.isConnected && state.roomId) {
					server.send('connection', {
						status: 'tiktok:room_found',
					});
				} else {
					server.send('connection', {
						status: 'tiktok:room_not_found',
					});
				}
			})
			.catch((error: unknown) => {
				const message = humanizeTikTokError(error);
				if (message === 'LIVE has ended') {
					server.send('connection', {
						status: 'tiktok:stream_ended',
					});
				} else {
					server.send('connection', {
						status: 'tiktok:error',
						message,
					});
				}
			});

		// Message events
		connection.on('chat', (data) => server.send('chat', data));
		connection.on('gift', (data) => server.send('gift', data));
		connection.on('like', (data) => server.send('like', data));
		connection.on('roomUser', (data) => server.send('room_user', data));
		connection.on('member', (data) => server.send('member', data));
		connection.on('liveIntro', (data) => server.send('live_intro', data));

		// Control events
		connection.on('streamEnd', () => {
			server.send('connection', {
				status: 'tiktok:stream_ended',
			});
		});
		connection.on('error', (error) => {
			server.send('connection', {
				status: 'tiktok:error',
				message: humanizeTikTokError(error),
			});
		});
		connection.on('disconnected', () => {
			server.send('connection', {
				status: 'tiktok:error',
				message: 'Disconnected from TikTok Live',
			});
		});

		return () => {
			connection.disconnect();
		};
	});
}
