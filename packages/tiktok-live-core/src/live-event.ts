import type { EmoteInfo, TopViewer, UserInfo } from './types.js';

export type LiveEventType =
	| 'chat'
	| 'emote_chat'
	| 'gift'
	| 'like'
	| 'member'
	| 'social'
	| 'subscribe'
	| 'intro'
	| 'viewer_count'
	| 'stream_end'
	| 'unknown';

export interface BaseLiveEvent {
	id: string;
	ts: number;
	type: LiveEventType;
	source: string;
	rawType?: string;
}

export interface ChatLiveEvent extends BaseLiveEvent {
	type: 'chat';
	user?: UserInfo;
	text: string;
	emotes?: EmoteInfo[];
}

export interface EmoteChatLiveEvent extends BaseLiveEvent {
	type: 'emote_chat';
	user?: UserInfo;
	emote?: EmoteInfo;
}

export interface GiftLiveEvent extends BaseLiveEvent {
	type: 'gift';
	user?: UserInfo;
	giftId?: string;
	groupId?: string;
	giftName?: string;
	giftImageUrl?: string;
	giftDescription?: string;
	giftType?: number;
	repeatCount?: number;
	repeatEnd?: boolean;
	diamondCount?: number;
	receiverUserId?: string;
}

export interface LikeLiveEvent extends BaseLiveEvent {
	type: 'like';
	user?: UserInfo;
	likeCount?: number;
	totalLikeCount?: number;
}

export interface MemberLiveEvent extends BaseLiveEvent {
	type: 'member';
	user?: UserInfo;
	action?: string;
}

export interface SocialLiveEvent extends BaseLiveEvent {
	type: 'social';
	user?: UserInfo;
}

export interface SubscribeLiveEvent extends BaseLiveEvent {
	type: 'subscribe';
	user?: UserInfo;
	subMonth?: number;
	subscribeType?: number;
}

export interface IntroLiveEvent extends BaseLiveEvent {
	type: 'intro';
	user?: UserInfo;
	description?: string;
}

export interface ViewerCountLiveEvent extends BaseLiveEvent {
	type: 'viewer_count';
	viewerCount: number;
	topViewers?: TopViewer[];
}

export interface StreamEndLiveEvent extends BaseLiveEvent {
	type: 'stream_end';
	reason?: string;
}

export interface UnknownLiveEvent extends BaseLiveEvent {
	type: 'unknown';
	preview?: string;
}

export type LiveEvent =
	| ChatLiveEvent
	| EmoteChatLiveEvent
	| GiftLiveEvent
	| LikeLiveEvent
	| MemberLiveEvent
	| SocialLiveEvent
	| SubscribeLiveEvent
	| IntroLiveEvent
	| ViewerCountLiveEvent
	| StreamEndLiveEvent
	| UnknownLiveEvent;
