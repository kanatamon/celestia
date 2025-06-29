import type { EventConfig } from '~/lib/rate-limiter.server';
import type {
	WebcastChatMessage,
	WebcastGiftMessage,
	WebcastLikeMessage,
	WebcastLiveIntroMessage,
	WebcastMemberMessage,
	WebcastRoomUserSeqMessage,
} from './live-event-types';
import { RateLimiter } from '~/lib/rate-limiter.server';
import { prisma } from '../db.server';
import { LiveEventDatabaseService } from './live-event-database.server';

// Define TikTok Live event types
export type TikTokLiveEventType =
	| 'chat'
	| 'gift'
	| 'like'
	| 'member'
	| 'roomUser'
	| 'liveIntro';

// Configuration type for TikTok Live events
export type TikTokLiveEventConfig = EventConfig<TikTokLiveEventType>;

const defaultConfig: TikTokLiveEventConfig = {
	chat: {
		alwaysAllow: true,
	},
	gift: {
		alwaysAllow: true,
	},
	like: {
		batchSize: 50,
		batchTimeoutMs: 100000,
	},
	member: {
		batchSize: 50,
		batchTimeoutMs: 100000,
	},
	roomUser: {
		maxPerMinute: 10,
	},
	liveIntro: {
		alwaysAllow: true,
	},
};

// Enhanced database service using the rate limiter
export class RateLimitedLiveEventDatabaseService {
	constructor(
		private database: LiveEventDatabaseService,
		private rateLimiter: RateLimiter<TikTokLiveEventType>,
	) {}

	async saveChatMessage(data: WebcastChatMessage, roomId: string) {
		const result = await this.rateLimiter.executeRateLimited(
			'chat',
			roomId,
			async () => {
				await this.database.saveChatMessage(data, roomId);
			},
		);
		return result.success;
	}

	async saveGiftMessage(data: WebcastGiftMessage, roomId: string) {
		const result = await this.rateLimiter.executeRateLimited(
			'gift',
			roomId,
			async () => {
				await this.database.saveGiftMessage(data, roomId);
			},
		);
		return result.success;
	}

	async saveLikeMessage(data: WebcastLikeMessage, roomId: string) {
		const result = await this.rateLimiter.executeRateLimited(
			'like',
			roomId,
			async () => {
				await this.database.saveLikeMessage(data, roomId);
			},
		);
		return result.success;
	}

	async saveMemberMessage(data: WebcastMemberMessage, roomId: string) {
		const result = await this.rateLimiter.executeRateLimited(
			'member',
			roomId,
			async () => {
				await this.database.saveMemberMessage(data, roomId);
			},
		);
		return result.success;
	}

	async saveRoomUserSeqMessage(
		data: WebcastRoomUserSeqMessage,
		roomId: string,
	) {
		const result = await this.rateLimiter.executeRateLimited(
			'roomUser',
			roomId,
			async () => {
				await this.database.saveRoomUserSeqMessage(data, roomId);
			},
		);
		return result.success;
	}

	async saveLiveIntroMessage(data: WebcastLiveIntroMessage, roomId: string) {
		const result = await this.rateLimiter.executeRateLimited(
			'liveIntro',
			roomId,
			async () => {
				await this.database.saveLiveIntroMessage(data, roomId);
			},
		);
		return result.success;
	}

	async cleanup() {
		return this.rateLimiter.cleanup();
	}

	getStats() {
		return this.rateLimiter.getStats();
	}
}

export const createRateLimitedLiveEventDatabaseService = (
	config: TikTokLiveEventConfig = defaultConfig,
): RateLimitedLiveEventDatabaseService => {
	const database = new LiveEventDatabaseService(prisma);
	const rateLimiter = new RateLimiter<TikTokLiveEventType>(
		config,
		'tiktok-live',
	);
	return new RateLimitedLiveEventDatabaseService(database, rateLimiter);
};
