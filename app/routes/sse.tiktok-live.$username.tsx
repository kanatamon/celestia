import type { ZodSchema } from 'zod';
import type { Route } from './+types/sse.tiktok-live.$username';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { z } from 'zod';
import { prisma } from '~/lib/db.server';
import { requireEnv } from '~/lib/env-utils.server';
import { eventStream } from '~/lib/event-stream.sever';
import { LiveEventDatabaseService } from '~/lib/live-event/live-event-database.server';
import { liveEventSchemas } from '~/lib/live-event/live-event-schemas';
import { TikTokLiveEventSender } from '~/lib/tiktok-live-events';

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
	params: { username },
}: Route.LoaderArgs) {
	const sessionId = requireEnv('SESSION_ID');
	return eventStream(request.signal, (send) => {
		let roomId: string | undefined;
		const database = new LiveEventDatabaseService(prisma);
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
					roomId = state.roomId;
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
		connection.on(
			...createEventParser(
				'chat',
				liveEventSchemas.webcastChatMessage,
				(data) => {
					server.send('chat', data);
					database.saveChatMessage(data, roomId!);
				},
			),
		);
		connection.on(
			...createEventParser(
				'gift',
				liveEventSchemas.webcastGiftMessage,
				(data) => {
					server.send('gift', data);
					database.saveGiftMessage(data, roomId!);
				},
			),
		);
		connection.on(
			...createEventParser(
				'like',
				liveEventSchemas.webcastLikeMessage,
				(data) => {
					server.send('like', data);
					database.saveLikeMessage(data, roomId!);
				},
			),
		);
		connection.on(
			...createEventParser(
				'roomUser',
				liveEventSchemas.webcastRoomUserSeqMessage,
				(data) => {
					server.send('room_user', data);
					database.saveRoomUserSeqMessage(data, roomId!);
				},
			),
		);
		connection.on(
			...createEventParser(
				'member',
				liveEventSchemas.webcastMemberMessage,
				(data) => {
					server.send('member', data);
					database.saveMemberMessage(data, roomId!);
				},
			),
		);
		connection.on(
			...createEventParser(
				'liveIntro',
				liveEventSchemas.webcastLiveIntroMessage,
				(data) => {
					server.send('live_intro', data);
					database.saveLiveIntroMessage(data, roomId!);
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
