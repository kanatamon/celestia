export interface UserBadge {
	type: string;
	badgeSceneType?: number;
	displayType?: number;
	url?: string;
	privilegeId?: string;
	level?: number;
	name?: string;
}

export interface UserDetails {
	createTime: string;
	bioDescription: string;
	profilePictureUrls?: string[];
}

export interface FollowInfo {
	followingCount: number;
	followerCount: number;
	followStatus: number;
	pushStatus: number;
}

export interface User {
	userId: string;
	secUid: string;
	uniqueId?: string;
	nickname: string;
	profilePictureUrl: string | null;
	followRole?: number;
	userBadges: UserBadge[];
	userSceneTypes: number[];
	userDetails: UserDetails;
	followInfo?: FollowInfo;
	isModerator: boolean;
	isNewGifter: boolean;
	isSubscriber: boolean;
	topGifterRank: number | null;
	gifterLevel: number;
	teamMemberLevel: number;
}

export interface WebcastLiveIntroMessage {
	description: string;
	userId: string;
	secUid: string;
	nickname: string;
	profilePictureUrl: string;
	userBadges: UserBadge[];
	userSceneTypes: number[];
	userDetails: UserDetails;
	isModerator: boolean;
	isNewGifter: boolean;
	isSubscriber: boolean;
	topGifterRank: number | null;
	gifterLevel: number;
	teamMemberLevel: number;
}

export interface WebcastChatMessage extends User {
	emotes: any[];
	comment?: string;
	msgId: string;
	createTime: string;
}

export interface TopViewer {
	user: User;
	coinCount: number;
}

export interface WebcastRoomUserSeqMessage {
	topViewers: TopViewer[];
	viewerCount: number;
}

export interface WebcastMemberMessage extends User {
	actionId: number;
	msgId: string;
	createTime: string;
	displayType: string;
	label: string;
}

export interface WebcastLikeMessage extends User {
	likeCount: number;
	totalLikeCount: number;
	msgId: string;
	createTime: string;
	displayType: string;
	label: string;
}

export interface Gift {
	gift_id: number;
	repeat_count: number;
	repeat_end: number;
	gift_type: number;
}

export interface WebcastGiftMessage extends User {
	giftId: number;
	repeatCount: number;
	groupId: string;
	msgId: string;
	createTime: string;
	displayType: string;
	label: string;
	repeatEnd: boolean;
	gift: Gift;
	describe: string;
	giftType: number;
	diamondCount: number;
	giftName: string;
	giftPictureUrl: string;
	timestamp: number;
	receiverUserId: string;
}

export interface WebcastMessageEvent {
	msgId: string;
	createTime: string;
}
