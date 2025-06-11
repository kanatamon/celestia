import type { Route } from './+types/sse.tiktok-live.$username';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { requireEnv } from '~/env-utils.server';
import { eventStream } from '~/event-stream.sever';
import { TikTokLiveEventSender } from '~/tiktok-live-events';

export async function loader({
	request,
	params: { username },
}: Route.LoaderArgs) {
	const sessionId = requireEnv('SESSION_ID');
	return eventStream(request.signal, (send) => {
		const sever = new TikTokLiveEventSender(send);
		const connection = new TikTokLiveConnection(username, {
			sessionId,
		});
		connection
			.connect()
			.then((state) => {
				sever.send('live_stream', {
					status: 'connected',
					roomId: state.roomId,
				});
			})
			.catch((error: unknown) => {
				sever.send('live_stream', {
					status: 'error',
					error: error instanceof Error ? error.message : `Unknown error`,
				});
			});

		connection.on(WebcastEvent.CHAT, (data) => sever.send('chat', data));
		connection.on(WebcastEvent.GIFT, (data) => sever.send('gift', data));
		connection.on(WebcastEvent.FOLLOW, (data) => sever.send('follow', data));
		connection.on(WebcastEvent.LIKE, (data) => sever.send('like', data));
		connection.on(WebcastEvent.QUESTION_NEW, (data) =>
			sever.send('question_new', data),
		);
		connection.on(WebcastEvent.ROOM_USER, (data) =>
			sever.send('room_user', data),
		);
		connection.on(WebcastEvent.MEMBER, (data) => sever.send('member', data));
		connection.on(WebcastEvent.SOCIAL, (data) => sever.send('social', data));
		connection.on(WebcastEvent.LINK_MIC_BATTLE, (data) =>
			sever.send('link_mic_battle', data),
		);
		connection.on(WebcastEvent.LINK_MIC_ARMIES, (data) =>
			sever.send('link_mic_armies', data),
		);
		connection.on(WebcastEvent.LIVE_INTRO, (data) =>
			sever.send('live_intro', data),
		);
		connection.on(WebcastEvent.EMOTE, (data) => sever.send('emote', data));
		connection.on(WebcastEvent.ENVELOPE, (data) =>
			sever.send('envelope', data),
		);
		connection.on(WebcastEvent.SUBSCRIBE, (data) =>
			sever.send('subscribe', data),
		);
		connection.on(WebcastEvent.SHARE, (data) => sever.send('share', data));
		connection.on(WebcastEvent.STREAM_END, () =>
			sever.send('live_stream', {
				status: 'disconnected',
				reason: `Stream ended`,
			}),
		);

		return () => {
			connection.disconnect();
		};
	});
}
