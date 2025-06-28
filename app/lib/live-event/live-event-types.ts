import type {
	followInfoSchema,
	giftSchema,
	topViewerSchema,
	userBadgeSchema,
	userDetailsSchema,
	userSchema,
	webcastChatMessageSchema,
	webcastGiftMessageSchema,
	webcastLikeMessageSchema,
	webcastLiveIntroMessageSchema,
	webcastMemberMessageSchema,
	webcastRoomUserSeqMessageSchema,
} from './live-event-schemas';
import { z } from 'zod';

export type WebcastMessageEvent = {
	msgId: string;
	createTime: string;
};

export type UserBadge = z.infer<typeof userBadgeSchema>;
export type UserDetails = z.infer<typeof userDetailsSchema>;
export type FollowInfo = z.infer<typeof followInfoSchema>;
export type User = z.infer<typeof userSchema>;
export type WebcastLiveIntroMessage = z.infer<
	typeof webcastLiveIntroMessageSchema
>;
export type WebcastChatMessage = z.infer<typeof webcastChatMessageSchema>;
export type TopViewer = z.infer<typeof topViewerSchema>;
export type WebcastRoomUserSeqMessage = z.infer<
	typeof webcastRoomUserSeqMessageSchema
>;
export type WebcastMemberMessage = z.infer<typeof webcastMemberMessageSchema>;
export type WebcastLikeMessage = z.infer<typeof webcastLikeMessageSchema>;
export type Gift = z.infer<typeof giftSchema>;
export type WebcastGiftMessage = z.infer<typeof webcastGiftMessageSchema>;
