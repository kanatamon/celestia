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

/**
 * The normalized social action carried by a WebcastSocialMessage, derived from
 * its `common.displayText.key`. Verified against a live stream (issue #91 HITL):
 * a follow carries `pm_main_follow_message_viewer*`, a share `pm_mt_guidance_share`.
 * `'follow'` is the follow *transition* the Follower Badge one-shot keys off;
 * `'share'`/`'other'` must never trigger it.
 */
export type SocialAction = 'follow' | 'share' | 'other';

export interface SocialLiveEvent extends BaseLiveEvent {
	type: 'social';
	user?: UserInfo;
	/**
	 * Raw i18n display key from `WebcastSocialMessage.common.displayText.key`
	 * (e.g. `pm_main_follow_message_viewer_2`, `pm_mt_guidance_share`). The
	 * authoritative discriminator; `action` is its normalization.
	 */
	displayType?: string;
	action?: SocialAction;
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
