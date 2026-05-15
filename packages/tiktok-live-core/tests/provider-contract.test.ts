import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
	UserInfo,
} from '../src/index.js';

const source = 'contract-test';
const eventTimestamp = 1_764_288_000_000;
const noop: Unsubscribe = () => {};

class ContractProvider implements TikTokLiveProvider {
	private state: ConnectionState = {
		status: 'idle',
		username: '',
	};

	async connect(username: string): Promise<ConnectionState> {
		this.state = {
			status: 'connected',
			username,
			viewerCount: 42,
		};

		return this.state;
	}

	async disconnect(): Promise<ConnectionState> {
		this.state = {
			status: 'disconnected',
			username: '',
		};

		return this.state;
	}

	getConnectionState(): ConnectionState {
		return this.state;
	}

	onEvent(handler: (event: LiveEvent) => void): Unsubscribe {
		handler({
			id: 'evt_1',
			ts: eventTimestamp,
			type: 'chat',
			source,
			rawType: 'WebcastChatMessage',
			text: 'hello',
			user: {
				uniqueId: 'celestia.viewer',
			},
		});

		return noop;
	}

	onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe {
		handler(this.state);

		return noop;
	}

	onLog(handler: (log: ProviderLog) => void): Unsubscribe {
		handler({
			id: 'log_1',
			ts: eventTimestamp,
			level: 'info',
			message: 'connected',
			details: {
				source,
			},
		});

		return noop;
	}

	destroy(): void {
		this.state = {
			status: 'disconnected',
			username: '',
		};
	}
}

const user: UserInfo = {
	userId: '123',
	uniqueId: 'celestia.viewer',
	secUid: 'sec_uid',
	nickname: 'Celestia Viewer',
	avatarUrl: 'https://example.test/avatar.png',
	bioDescription: 'watches TikTok Live',
	followingCount: 1,
	followerCount: 2,
};

const events: LiveEvent[] = [
	{
		id: 'chat_1',
		ts: 1,
		type: 'chat',
		source,
		text: 'hello',
		user,
		emotes: [{ emoteId: 'wave', imageUrl: 'https://example.test/wave.png', placeInComment: 0 }],
	},
	{
		id: 'emote_1',
		ts: 2,
		type: 'emote_chat',
		source,
		user,
		emote: { emoteId: 'heart' },
	},
	{
		id: 'gift_1',
		ts: 3,
		type: 'gift',
		source,
		user,
		giftId: '5655',
		giftName: 'Rose',
		giftImageUrl: 'https://example.test/rose.png',
		giftDescription: 'sent a Rose',
		giftType: 1,
		repeatCount: 3,
		repeatEnd: true,
		diamondCount: 1,
		receiverUserId: 'host_1',
	},
	{
		id: 'like_1',
		ts: 4,
		type: 'like',
		source,
		user,
		likeCount: 10,
		totalLikeCount: 100,
	},
	{
		id: 'member_1',
		ts: 5,
		type: 'member',
		source,
		user,
		action: 'joined',
	},
	{
		id: 'social_1',
		ts: 6,
		type: 'social',
		source,
		user,
	},
	{
		id: 'subscribe_1',
		ts: 7,
		type: 'subscribe',
		source,
		user,
		subMonth: 2,
		subscribeType: 1,
	},
	{
		id: 'intro_1',
		ts: 8,
		type: 'intro',
		source,
		user,
		description: 'intro text',
	},
	{
		id: 'viewer_count_1',
		ts: 9,
		type: 'viewer_count',
		source,
		viewerCount: 123,
		topViewers: [{ coinCount: 10, user }],
	},
	{
		id: 'stream_end_1',
		ts: 10,
		type: 'stream_end',
		source,
		reason: 'ended by host',
	},
	{
		id: 'unknown_1',
		ts: 11,
		type: 'unknown',
		source,
		preview: 'opaque payload',
	},
];

function getEventText(event: LiveEvent): string | undefined {
	if (event.type === 'chat') {
		return event.text;
	}

	return undefined;
}

void new ContractProvider().connect('celestia.creator');
void events.map(getEventText);
