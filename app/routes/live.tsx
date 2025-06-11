import type { TikTokLiveEventData } from '~/tiktok-live-events';
import type { Route } from './+types/live';
import { useEffect, useState } from 'react';
import invariant from 'tiny-invariant';
import { TikTokLiveEventSource } from '~/tiktok-live-events';

export function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const username = url.searchParams.get('username');
	invariant(
		username,
		`Username is required in the search params. Example: ?username=your_username`,
	);
	return {
		username,
	};
}

const useTikTokLiveEvents = (username: string) => {
	const [connection, setConnection] =
		useState<TikTokLiveEventData<'live_stream'>>();
	const [messages, setMessages] = useState<TikTokLiveEventData<'chat'>[]>([]);

	useEffect(() => {
		const source = new TikTokLiveEventSource(`/sse/tiktok-live/${username}`, {
			onError: (error) => {
				setConnection({ status: 'error', error: error.message });
			},
		});

		source.onEvents({
			live_stream: (data) => setConnection(data),
			// error: () =>
			// 	setConnection({ status: 'error', error: 'Connection failed' }),
			chat: (data) => setMessages((prev) => [...prev, data]),
			gift: console.info,
			follow: console.info,
			like: console.info,
			share: console.info,
			room_user: console.info,
			subscribe: console.info,
		});

		return () => source.close();
	}, [username]);

	return { connection, messages };
};

export default function LiveRoute({
	loaderData: { username },
}: Route.ComponentProps) {
	const { connection, messages } = useTikTokLiveEvents(username);
	console.log('Live connection:', connection);
	if (!connection) {
		return <div>Connecting to TikTok Live...</div>;
	}

	if (connection.status === 'error') {
		return <div>Error: {connection.error}</div>;
	}

	return (
		<div>
			<u>
				<h1>TikTok Live Stream for @{username}</h1>
				<div>
					<h2>Chat Messages</h2>
					{messages.map((msg, index) => (
						<div key={index}>
							<strong>{msg.user?.nickname}:</strong> {msg.comment}
						</div>
					))}
				</div>
			</u>
		</div>
	);
}
