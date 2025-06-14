import type { Route } from './+types/sse.tiktok-live.$username';
import {
	AlreadyConnectedError,
	AlreadyConnectingError,
	ExtractRoomIdError,
	FetchIsLiveError,
	InvalidResponseError,
	InvalidSchemaNameError,
	InvalidUniqueIdError,
	MissingRoomIdError,
	TikTokLiveConnection,
	UserOfflineError,
	WebcastEvent,
} from 'tiktok-live-connector';
import { requireEnv } from '~/lib/env-utils.server';
import { eventStream } from '~/lib/event-stream.sever';
import { TikTokLiveEventSender } from '~/lib/tiktok-live-events';

function humanizeTikTokError(error: unknown): string {
	if (error instanceof ExtractRoomIdError) {
		return 'Invalid username or room not found';
	}
	if (error instanceof InvalidUniqueIdError) {
		return 'Invalid username or room not found';
	}
	if (error instanceof FetchIsLiveError) {
		return 'Failed to fetch live status, room might not be live';
	}
	if (error instanceof InvalidResponseError) {
		return `Invalid response from TikTok API: ${error.message}`;
	}
	if (error instanceof MissingRoomIdError) {
		return 'Missing room ID, unable to connect to TikTok live';
	}
	if (error instanceof AlreadyConnectingError) {
		return 'Already connecting to TikTok live, please wait';
	}
	if (error instanceof AlreadyConnectedError) {
		return 'Already connected to TikTok live';
	}
	if (error instanceof UserOfflineError) {
		return 'User is offline, no live stream available';
	}
	if (error instanceof InvalidSchemaNameError) {
		return 'Invalid schema name, please check the TikTok live connector configuration';
	}
	if (error instanceof TikTokLiveConnection) {
		return 'TikTok live connection error, please check your connection settings';
	}
	if (error instanceof Error) {
		return error.message;
	}
	return `Unknown error, received: ${String(error)}`;
}

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
		sever.send('connection', {
			status: 'tiktok:authenticating',
		});
		connection
			.connect()
			.then((state) => {
				if (state.isConnected && state.roomId) {
					sever.send('connection', {
						status: 'tiktok:room_found',
					});
				} else {
					sever.send('connection', {
						status: 'tiktok:room_not_found',
					});
				}
			})
			.catch((error: unknown) => {
				sever.send('connection', {
					status: 'tiktok:error',
					message: humanizeTikTokError(error),
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
			sever.send('connection', {
				status: 'tiktok:stream_ended',
			}),
		);

		return () => {
			connection.disconnect();
		};
	});
}
