import type {
	ConnectionState,
	LiveEvent,
	ProviderLog,
	TikTokLiveProvider,
	Unsubscribe,
	UserInfo,
} from '../src/index.js';

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
			ts: 1_764_288_000_000,
			type: 'chat',
			source: 'contract-test',
			rawType: 'WebcastChatMessage',
			text: 'hello',
			user: {
				uniqueId: 'celestia.viewer',
			},
		});

		return () => {};
	}

	onConnectionState(handler: (state: ConnectionState) => void): Unsubscribe {
		handler(this.state);

		return () => {};
	}

	onLog(handler: (log: ProviderLog) => void): Unsubscribe {
		handler({
			id: 'log_1',
			ts: 1_764_288_000_000,
			level: 'info',
			message: 'connected',
			details: {
				source: 'contract-test',
			},
		});

		return () => {};
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
		source: 'contract-test',
		text: 'hello',
		user,
		emotes: [{ emoteId: 'wave', imageUrl: 'https://example.test/wave.png', placeInComment: 0 }],
	},
	{
		id: 'emote_1',
		ts: 2,
		type: 'emote_chat',
		source: 'contract-test',
		user,
		emote: { emoteId: 'heart' },
	},
	{
		id: 'gift_1',
		ts: 3,
		type: 'gift',
		source: 'contract-test',
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
		source: 'contract-test',
		user,
		likeCount: 10,
		totalLikeCount: 100,
	},
	{
		id: 'member_1',
		ts: 5,
		type: 'member',
		source: 'contract-test',
		user,
		action: 'joined',
	},
	{
		id: 'social_1',
		ts: 6,
		type: 'social',
		source: 'contract-test',
		user,
	},
	{
		id: 'subscribe_1',
		ts: 7,
		type: 'subscribe',
		source: 'contract-test',
		user,
		subMonth: 2,
		subscribeType: 1,
	},
	{
		id: 'intro_1',
		ts: 8,
		type: 'intro',
		source: 'contract-test',
		user,
		description: 'intro text',
	},
	{
		id: 'viewer_count_1',
		ts: 9,
		type: 'viewer_count',
		source: 'contract-test',
		viewerCount: 123,
		topViewers: [{ coinCount: 10, user }],
	},
	{
		id: 'stream_end_1',
		ts: 10,
		type: 'stream_end',
		source: 'contract-test',
		reason: 'ended by host',
	},
	{
		id: 'unknown_1',
		ts: 11,
		type: 'unknown',
		source: 'contract-test',
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
