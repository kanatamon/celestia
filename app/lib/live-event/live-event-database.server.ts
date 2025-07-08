import type { PrismaClient } from '@prisma/client';
import type {
	User,
	WebcastChatMessage,
	WebcastGiftMessage,
	WebcastLikeMessage,
	WebcastMemberMessage,
	WebcastRoomUserSeqMessage,
} from './live-event-types';
import { Prisma } from '@prisma/client';

/**
 * Helper function to check if a Prisma error should be silently ignored
 * @param error - The error to check
 * @returns true if the error should be silently ignored, false otherwise
 */
const shouldSilentlyIgnoreError = (error: unknown): boolean => {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		(error.code === 'P2002' || // Unique constraint failed
			error.code === 'P2003' || // Foreign key constraint failed
			error.code === 'P2025') // Record to update not found
	);
};

/**
 * Execute a database operation with silent error handling for common constraint violations
 * @param operation - The async database operation to execute
 * @param errorMessage - Optional custom error message for logging
 * @returns The result of the operation or null if silently ignored
 */
const executeWithSilentErrors = async <T>(
	operation: () => Promise<T>,
	errorMessage?: string,
): Promise<T | null> => {
	try {
		return await operation();
	} catch (error) {
		if (shouldSilentlyIgnoreError(error)) {
			// Silently ignore constraint violations, unique constraint failures, etc.
			return null;
		}
		if (errorMessage) {
			console.error(errorMessage, error);
		}
		throw error;
	}
};

export class LiveEventDatabaseService {
	constructor(private prisma: PrismaClient) {}

	private async upsertUser(userData: User) {
		return executeWithSilentErrors(async () => {
			return await this.prisma.user.upsert({
				where: { userId: userData.userId },
				update: {
					// Update changeable fields
					nickname: userData.nickname,
					profilePictureUrl: userData.profilePictureUrl,
					uniqueId: userData.uniqueId,
					followRole: userData.followRole,
					isModerator: userData.isModerator,
					isNewGifter: userData.isNewGifter,
					isSubscriber: userData.isSubscriber,
					topGifterRank: userData.topGifterRank,
					gifterLevel: userData.gifterLevel,
					teamMemberLevel: userData.teamMemberLevel,
					userSceneTypes: userData.userSceneTypes,
					followInfo: {
						update: userData.followInfo,
					},
					updatedAt: new Date(),
				},
				create: {
					userId: userData.userId,
					secUid: userData.secUid,
					uniqueId: userData.uniqueId,
					nickname: userData.nickname,
					profilePictureUrl: userData.profilePictureUrl,
					followRole: userData.followRole,
					isModerator: userData.isModerator,
					isNewGifter: userData.isNewGifter,
					isSubscriber: userData.isSubscriber,
					topGifterRank: userData.topGifterRank,
					gifterLevel: userData.gifterLevel,
					teamMemberLevel: userData.teamMemberLevel,
					userSceneTypes: userData.userSceneTypes,
					followInfo: {
						create: {
							id: userData.userId,
							...userData.followInfo,
						},
					},
				},
			});
		}, 'Failed to upsert user:');
	}

	// Save chat message
	async saveChatMessage(data: WebcastChatMessage, roomId: string) {
		// First upsert the user
		await this.upsertUser(data);

		// Then create the chat message (ignore if duplicate msgId)
		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastChatMessage.create({
				data: {
					roomId,
					id: data.msgId,
					msgId: data.msgId,
					userId: data.userId,
					comment: data.comment,
					emotes: data.emotes,
					createTime: data.createTime,
					createdAt: new Date(+data.createTime),
				},
			});
		}, 'Failed to save chat message:');
	}

	// Save gift message
	async saveGiftMessage(data: WebcastGiftMessage, roomId: string) {
		await this.upsertUser(data);

		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastGiftMessage.create({
				data: {
					id: data.msgId,
					roomId: roomId,
					msgId: data.msgId,
					userId: data.userId,
					giftId: data.giftId,
					repeatCount: data.repeatCount,
					groupId: data.groupId,
					displayType: data.displayType,
					label: data.label,
					repeatEnd: data.repeatEnd,
					describe: data.describe,
					giftType: data.giftType,
					diamondCount: data.diamondCount,
					giftName: data.giftName,
					giftPictureUrl: data.giftPictureUrl,
					timestamp: data.timestamp,
					receiverUserId: data.receiverUserId,
					createTime: data.createTime,
					createdAt: new Date(+data.createTime),
				},
			});
		}, 'Failed to save gift message:');
	}

	// Save like message
	async saveLikeMessage(data: WebcastLikeMessage, roomId: string) {
		await this.upsertUser(data);

		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastLikeMessage.create({
				data: {
					id: data.msgId,
					roomId,
					msgId: data.msgId,
					userId: data.userId,
					likeCount: data.likeCount,
					totalLikeCount: data.totalLikeCount,
					displayType: data.displayType,
					label: data.label,
					createTime: data.createTime,
					createdAt: new Date(+data.createTime),
				},
			});
		}, 'Failed to save like message:');
	}

	// Save member message
	async saveMemberMessage(data: WebcastMemberMessage, roomId: string) {
		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastMemberMessage.create({
				data: {
					roomId,
					id: data.msgId,
					userId: data.userId,
					createTime: data.createTime,
					createdAt: new Date(+data.createTime),
				},
			});
		}, 'Failed to save member message:');
	}

	// Save room user sequence message
	async saveRoomUserSeqMessage(
		data: WebcastRoomUserSeqMessage & { eventArrivalDate: Date },
		roomId: string,
	) {
		const uniqueId = `${roomId}:${Math.floor(Date.now() / 1000)}:${data.viewerCount}`;
		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastRoomUserSeqMessage.create({
				data: {
					id: uniqueId,
					roomId,
					viewerCount: data.viewerCount,
					createdAt: data.eventArrivalDate,
				},
			});
		}, 'Failed to save room user sequence message:');
	}

	async saveLiveIntroMessage(
		data: {
			description?: string;
			streamerUniqueId: string;
		},
		roomId: string,
	) {
		const id = `${data.streamerUniqueId}:${roomId}`;
		return executeWithSilentErrors(async () => {
			return await this.prisma.webcastLiveIntroMessage.upsert({
				where: { id },
				update: {
					description: data.description,
				},
				create: {
					id,
					roomId,
					streamerUniqueId: data.streamerUniqueId,
					description: data.description,
				},
			});
		}, 'Failed to save live intro message:');
	}
}
