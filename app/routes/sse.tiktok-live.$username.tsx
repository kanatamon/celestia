import type { ZodSchema } from 'zod';
import type { Route } from './+types/sse.tiktok-live.$username';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { z } from 'zod';
import { requireEnv } from '~/lib/env-utils.server';
import { eventStream } from '~/lib/event-stream.sever';
import { LiveEventServerSender } from '~/lib/live-event/live-event-communication';
import { createRateLimitedLiveEventDatabaseService } from '~/lib/live-event/live-event-database-rate-limiter.server';
import { liveEventSchemas } from '~/lib/live-event/live-event-schemas';

const createEventParser = <T extends ZodSchema>(
	eventName: string,
	schema: T,
	callback: (validatedData: z.infer<T>) => void,
) => {
	return [
		eventName,
		(data: unknown) => {
			const parsed = schema.safeParse(data);
			if (parsed.success) {
				callback(parsed.data);
				return parsed.data;
			} else {
				console.warn(
					`Failed to parse ${eventName} event data:`,
					JSON.stringify(parsed.error, null, 2),
					JSON.stringify(data, null, 2),
				);
				return null;
			}
		},
	] as const;
};

const humanizeTikTokError = (error: unknown) => {
	if (!(error instanceof Error)) {
		return String(error);
	}
	if (error.message === 'LIVE has ended') {
		return 'LIVE has ended';
	}
	return error.message;
};

export async function loader({
	request,
	params: { username: streamerUniqueId },
}: Route.LoaderArgs) {
	const sessionId = requireEnv('SESSION_ID');
	return eventStream(request.signal, (send) => {
		let roomId: string | undefined;
		const database = createRateLimitedLiveEventDatabaseService();
		const server = new LiveEventServerSender(send);
		const connection = new WebcastPushConnection(streamerUniqueId, {
			sessionId,
		});
		server.send('connection', {
			status: 'tiktok:authenticating',
		});
		connection
			.connect()
			.then((state) => {
				if (state.isConnected && state.roomId) {
					roomId = state.roomId;
					server.send('connection', {
						status: 'tiktok:room_found',
					});
					database.saveLiveIntroMessage(
						{
							streamerUniqueId,
						},
						state.roomId,
					);
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
		connection.on(
			...createEventParser(
				'chat',
				liveEventSchemas.webcastChatMessage,
				(data) => {
					server.send('chat', data);
					if (roomId) database.saveChatMessage(data, roomId);
				},
			),
		);
		connection.on(
			...createEventParser(
				'gift',
				liveEventSchemas.webcastGiftMessage,
				(data) => {
					server.send('gift', data);
					if (roomId) database.saveGiftMessage(data, roomId);
				},
			),
		);
		connection.on(
			...createEventParser(
				'like',
				liveEventSchemas.webcastLikeMessage,
				(data) => {
					server.send('like', data);
					if (roomId) database.saveLikeMessage(data, roomId);
				},
			),
		);
		connection.on(
			...createEventParser(
				'roomUser',
				liveEventSchemas.webcastRoomUserSeqMessage,
				(data) => {
					server.send('room_user', data);
					if (roomId) database.saveRoomUserSeqMessage(data, roomId);
				},
			),
		);
		connection.on(
			...createEventParser(
				'member',
				liveEventSchemas.webcastMemberMessage,
				(data) => {
					server.send('member', data);
					if (roomId) database.saveMemberMessage(data, roomId);
				},
			),
		);
		connection.on(
			...createEventParser(
				'liveIntro',
				liveEventSchemas.webcastLiveIntroMessage,
				(data) => {
					server.send('live_intro', data);
					if (roomId) {
						database.saveLiveIntroMessage(
							{
								description: data.description,
								streamerUniqueId,
							},
							roomId,
						);
					}
				},
			),
		);

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

		return () => {
			connection.disconnect();
		};
	});
}
