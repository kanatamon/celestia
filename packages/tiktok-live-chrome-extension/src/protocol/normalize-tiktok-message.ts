import type { LiveEvent, UserInfo } from '@celestia/tiktok-live-core';
import type { DecodedTikTokMessage, User, WebcastMessage } from './tiktok-live.generated.js';
import { decodeTikTokMessage } from './tiktok-live.generated.js';

export const liveEventSource = 'tiktok-live-chrome-extension';

export function normalizeTikTokMessage(message: WebcastMessage): LiveEvent {
	const decoded = decodeTikTokMessage(message.type, message.binary);
	const id = eventId(decoded, message);
	const ts = eventTimestamp(decoded);
	const user = normalizeUser(decoded.user);

	switch (message.type) {
		case 'WebcastChatMessage':
			return {
				id,
				ts,
				type: 'chat',
				source: liveEventSource,
				rawType: message.type,
				text: decoded.comment ?? '',
				user,
				emotes: decoded.emotes?.map((item) => ({
					emoteId: item.emote?.emoteId ?? '',
					imageUrl: item.emote?.image?.imageUrl,
					placeInComment: item.placeInComment,
				})),
			};
		case 'WebcastEmoteChatMessage':
			return {
				id,
				ts,
				type: 'emote_chat',
				source: liveEventSource,
				rawType: message.type,
				user,
				emote: decoded.emote?.emoteId
					? { emoteId: decoded.emote.emoteId, imageUrl: decoded.emote.image?.imageUrl }
					: undefined,
			};
		case 'WebcastGiftMessage':
			return {
				id,
				ts,
				type: 'gift',
				source: liveEventSource,
				rawType: message.type,
				user,
				giftId: decoded.giftId?.toString(),
				groupId: decoded.groupId,
				giftName: decoded.giftDetails?.giftName,
				giftImageUrl: decoded.giftDetails?.giftImage?.giftPictureUrl,
				giftDescription: decoded.giftDetails?.describe,
				giftType: decoded.giftDetails?.giftType,
				repeatCount: decoded.repeatCount,
				repeatEnd: decoded.repeatEnd === undefined ? undefined : decoded.repeatEnd !== 0,
				diamondCount: decoded.giftDetails?.diamondCount,
				receiverUserId: decoded.giftExtra?.receiverUserId,
			};
		case 'WebcastLikeMessage':
			return {
				id,
				ts,
				type: 'like',
				source: liveEventSource,
				rawType: message.type,
				user,
				likeCount: decoded.likeCount,
				totalLikeCount: decoded.totalLikeCount,
			};
		case 'WebcastMemberMessage':
			return {
				id,
				ts,
				type: 'member',
				source: liveEventSource,
				rawType: message.type,
				user,
				action: humanizeMemberAction(decoded.actionId),
			};
		case 'WebcastSocialMessage':
			return { id, ts, type: 'social', source: liveEventSource, rawType: message.type, user };
		case 'WebcastSubNotifyMessage':
			return {
				id,
				ts,
				type: 'subscribe',
				source: liveEventSource,
				rawType: message.type,
				user,
				subMonth: decoded.subMonth,
				subscribeType: decoded.subscribeType,
			};
		case 'WebcastLiveIntroMessage':
			return {
				id,
				ts,
				type: 'intro',
				source: liveEventSource,
				rawType: message.type,
				user,
				description: decoded.description,
			};
		case 'WebcastRoomUserSeqMessage':
			return {
				id,
				ts,
				type: 'viewer_count',
				source: liveEventSource,
				rawType: message.type,
				viewerCount: decoded.viewerCount ?? 0,
				topViewers: decoded.topViewers?.map((viewer) => ({
					coinCount: viewer.coinCount === undefined ? undefined : Number(viewer.coinCount),
					user: normalizeUser(viewer.user),
				})),
			};
		case 'WebcastControlMessage':
			if (decoded.action === 3) {
				return {
					id,
					ts,
					type: 'stream_end',
					source: liveEventSource,
					rawType: message.type,
					reason: 'ended by host',
				};
			}
			break;
	}

	return {
		id,
		ts,
		type: 'unknown',
		source: liveEventSource,
		rawType: message.type,
		preview: bytesPreview(message.binary),
	};
}

function normalizeUser(user: User | undefined): UserInfo | undefined {
	if (!user) return undefined;
	return {
		userId: user.userId,
		uniqueId: user.uniqueId,
		secUid: user.secUid,
		nickname: user.nickname,
		avatarUrl: user.profilePicture?.urls[0],
		bioDescription: user.bioDescription,
		followingCount: user.followInfo?.followingCount,
		followerCount: user.followInfo?.followerCount,
		followStatus: user.followInfo?.followStatus,
	};
}

function eventId(decoded: DecodedTikTokMessage, message: WebcastMessage): string {
	return decoded.event?.msgId ?? decoded.id ?? `${message.type}:${hashBytes(message.binary)}`;
}

function eventTimestamp(decoded: DecodedTikTokMessage): number {
	const createTime = decoded.event?.createTime;
	return createTime === undefined ? Date.now() : Number(createTime);
}

function humanizeMemberAction(actionId: number | undefined): string | undefined {
	if (actionId === undefined) return undefined;
	switch (actionId) {
		case 1:
			return 'joined';
		case 2:
			return 'followed';
		case 3:
			return 'subscribed';
		case 52:
			return 'joined_following';
		default:
			return actionId.toString();
	}
}

function bytesPreview(bytes: Uint8Array): string {
	return Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hashBytes(bytes: Uint8Array): string {
	let hash = 0x811c9dc5;
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}
