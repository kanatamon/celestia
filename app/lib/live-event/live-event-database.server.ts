import type { PrismaClient } from '@prisma/client';
import type {
	User,
	WebcastChatMessage,
	WebcastGiftMessage,
	WebcastLikeMessage,
	WebcastLiveIntroMessage,
	WebcastMemberMessage,
	WebcastRoomUserSeqMessage,
} from './live-event-types';

export class LiveEventDatabaseService {
	constructor(private prisma: PrismaClient) {}

	private async upsertUser(userData: User) {
		try {
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
		} catch (error) {
			console.error('Failed to upsert user:', error);
			throw error;
		}
	}

	// Save chat message
	async saveChatMessage(data: WebcastChatMessage, roomId: string) {
		try {
			// First upsert the user
			await this.upsertUser(data);

			// Then create the chat message (ignore if duplicate msgId)
			await this.prisma.webcastChatMessage.upsert({
				where: { msgId: data.msgId },
				update: {}, // Don't update existing messages
				create: {
					roomId,
					id: data.msgId,
					msgId: data.msgId,
					userId: data.userId,
					comment: data.comment,
					emotes: data.emotes,
					createTime: data.createTime,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save chat message:', error);
		}
	}

	// Save gift message
	async saveGiftMessage(data: WebcastGiftMessage, roomId: string) {
		try {
			await this.upsertUser(data);

			await this.prisma.webcastGiftMessage.upsert({
				where: { msgId: data.msgId },
				update: {},
				create: {
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
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save gift message:', error);
		}
	}

	// Save like message
	async saveLikeMessage(data: WebcastLikeMessage, roomId: string) {
		try {
			await this.upsertUser(data);

			await this.prisma.webcastLikeMessage.upsert({
				where: { msgId: data.msgId },
				update: {},
				create: {
					id: data.msgId,
					roomId,
					msgId: data.msgId,
					userId: data.userId,
					likeCount: data.likeCount,
					totalLikeCount: data.totalLikeCount,
					displayType: data.displayType,
					label: data.label,
					// createTime: new Date(data.createTime),
					createTime: data.createTime,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save like message:', error);
		}
	}

	// Save member message
	async saveMemberMessage(data: WebcastMemberMessage, roomId: string) {
		try {
			await this.upsertUser(data);

			await this.prisma.webcastMemberMessage.upsert({
				where: { msgId: data.msgId },
				update: {},
				create: {
					roomId,
					id: data.msgId,
					msgId: data.msgId,
					userId: data.userId,
					actionId: data.actionId,
					displayType: data.displayType,
					label: data.label,
					createTime: data.createTime,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save member message:', error);
		}
	}

	// Save room user sequence message
	async saveRoomUserSeqMessage(
		data: WebcastRoomUserSeqMessage,
		roomId: string,
	) {
		try {
			// Save room stats
			await this.prisma.webcastRoomUserSeqMessage.create({
				data: {
					roomId,
					viewerCount: data.viewerCount,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save room user sequence message:', error);
		}
	}

	async saveLiveIntroMessage(data: WebcastLiveIntroMessage, roomId: string) {
		try {
			await this.upsertUser(data);

			await this.prisma.webcastLiveIntroMessage.create({
				data: {
					...data,
					roomId,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			console.error('Failed to save live intro message:', error);
		}
	}
}
