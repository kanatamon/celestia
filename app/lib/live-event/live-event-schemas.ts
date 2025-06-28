import { z } from 'zod';

export const userBadgeSchema = z.object({
	type: z.string(),
	badgeSceneType: z.number().optional(),
	displayType: z.number().optional(),
	url: z.string().optional(),
	privilegeId: z.string().optional(),
	level: z.number().optional(),
	name: z.string().optional(),
});

export const userDetailsSchema = z.object({
	createTime: z.string(),
	bioDescription: z.string(),
	profilePictureUrls: z.array(z.string()).optional(),
});

export const followInfoSchema = z.object({
	followingCount: z.number(),
	followerCount: z.number(),
	followStatus: z.number(),
	pushStatus: z.number(),
});

export const userSchema = z.object({
	userId: z.string(),
	secUid: z.string(),
	uniqueId: z.string().optional(),
	nickname: z.string().optional(),
	profilePictureUrl: z.string().nullable(),
	followRole: z.number().optional(),
	userBadges: z.array(userBadgeSchema),
	userSceneTypes: z.array(z.number()),
	userDetails: userDetailsSchema,
	followInfo: followInfoSchema.optional(),
	isModerator: z.boolean(),
	isNewGifter: z.boolean(),
	isSubscriber: z.boolean(),
	topGifterRank: z.number().nullable(),
	gifterLevel: z.number(),
	teamMemberLevel: z.number(),
});

export const webcastLiveIntroMessageSchema = z.object({
	description: z.string(),
	userId: z.string(),
	secUid: z.string(),
	nickname: z.string(),
	profilePictureUrl: z.string(),
	userBadges: z.array(userBadgeSchema),
	userSceneTypes: z.array(z.number()),
	userDetails: userDetailsSchema,
	isModerator: z.boolean(),
	isNewGifter: z.boolean(),
	isSubscriber: z.boolean(),
	topGifterRank: z.number().nullable(),
	gifterLevel: z.number(),
	teamMemberLevel: z.number(),
});

export const webcastChatMessageSchema = userSchema.extend({
	emotes: z.array(z.any()),
	comment: z.string(),
	msgId: z.string(),
	createTime: z.string(),
});

export const topViewerSchema = z.object({
	user: userSchema,
	coinCount: z.number(),
});

export const webcastRoomUserSeqMessageSchema = z.object({
	topViewers: z.array(topViewerSchema),
	viewerCount: z.number(),
});

export const webcastMemberMessageSchema = userSchema.partial().extend({
	actionId: z.number(),
	msgId: z.string(),
	createTime: z.string(),
	displayType: z.string().optional(),
	label: z.string().optional(),
});

export const webcastLikeMessageSchema = userSchema.extend({
	likeCount: z.number(),
	totalLikeCount: z.number(),
	msgId: z.string(),
	createTime: z.string(),
	displayType: z.string(),
	label: z.string(),
});

export const giftSchema = z.object({
	gift_id: z.number(),
	repeat_count: z.number(),
	repeat_end: z.number(),
	gift_type: z.number(),
});

export const webcastGiftMessageSchema = userSchema.extend({
	giftId: z.number(),
	repeatCount: z.number(),
	groupId: z.string(),
	msgId: z.string(),
	createTime: z.string(),
	displayType: z.string(),
	label: z.string(),
	repeatEnd: z.boolean(),
	gift: giftSchema,
	describe: z.string(),
	giftType: z.number(),
	diamondCount: z.number(),
	giftName: z.string(),
	giftPictureUrl: z.string(),
	timestamp: z.number(),
	receiverUserId: z.string(),
});

export const liveEventSchemas = {
	userBadge: userBadgeSchema,
	userDetails: userDetailsSchema,
	followInfo: followInfoSchema,
	user: userSchema,
	topViewer: topViewerSchema,
	gift: giftSchema,
	webcastLiveIntroMessage: webcastLiveIntroMessageSchema,
	webcastChatMessage: webcastChatMessageSchema,
	webcastRoomUserSeqMessage: webcastRoomUserSeqMessageSchema,
	webcastMemberMessage: webcastMemberMessageSchema,
	webcastLikeMessage: webcastLikeMessageSchema,
	webcastGiftMessage: webcastGiftMessageSchema,
};
