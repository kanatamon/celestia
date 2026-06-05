export interface WebcastWebsocketMessage {
	id?: string;
	type?: string;
	binary?: Uint8Array;
}

export interface WebcastResponse {
	messages: WebcastMessage[];
}

export interface WebcastMessage {
	type: string;
	binary: Uint8Array;
}

export interface WebcastMessageEvent {
	msgId?: string;
	createTime?: string;
}

export interface User {
	userId?: string;
	nickname?: string;
	profilePicture?: { urls: string[] };
	uniqueId?: string;
	secUid?: string;
	bioDescription?: string;
	followInfo?: {
		followingCount?: number;
		followerCount?: number;
		followStatus?: number;
	};
}

export interface DecodedTikTokMessage {
	event?: WebcastMessageEvent;
	user?: User;
	comment?: string;
	emotes?: { placeInComment?: number; emote?: { emoteId?: string; image?: { imageUrl?: string } } }[];
	emote?: { emoteId?: string; image?: { imageUrl?: string } };
	giftId?: number;
	repeatCount?: number;
	repeatEnd?: number;
	groupId?: string;
	giftDetails?: {
		giftImage?: { giftPictureUrl?: string };
		giftName?: string;
		describe?: string;
		giftType?: number;
		diamondCount?: number;
	};
	giftExtra?: { receiverUserId?: string };
	likeCount?: number;
	totalLikeCount?: number;
	actionId?: number;
	displayType?: string;
	action?: number;
	id?: string;
	description?: string;
	viewerCount?: number;
	topViewers?: { coinCount?: string; user?: User }[];
	subMonth?: number;
	subscribeType?: number;
}

class ProtoReader {
	private offset = 0;

	constructor(private readonly bytes: Uint8Array) {}

	done(): boolean {
		return this.offset >= this.bytes.length;
	}

	tag(): { field: number; wire: number } {
		const value = Number(this.varint());
		return { field: value >>> 3, wire: value & 7 };
	}

	varint(): bigint {
		let shift = 0n;
		let result = 0n;
		while (!this.done()) {
			const byte = this.bytes[this.offset++] ?? 0;
			result |= BigInt(byte & 0x7f) << shift;
			if ((byte & 0x80) === 0) {
				return result;
			}
			shift += 7n;
		}
		throw new Error('Unexpected end of varint');
	}

	int32(): number {
		return Number(this.varint());
	}

	bool(): boolean {
		return this.varint() !== 0n;
	}

	bytesField(): Uint8Array {
		const length = Number(this.varint());
		const start = this.offset;
		this.offset += length;
		if (this.offset > this.bytes.length) {
			throw new Error('Unexpected end of bytes field');
		}
		return this.bytes.slice(start, this.offset);
	}

	string(): string {
		return new TextDecoder().decode(this.bytesField());
	}

	skip(wire: number): void {
		if (wire === 0) {
			this.varint();
			return;
		}
		if (wire === 1) {
			this.offset += 8;
			return;
		}
		if (wire === 2) {
			this.bytesField();
			return;
		}
		if (wire === 5) {
			this.offset += 4;
			return;
		}
		throw new Error(`Unsupported protobuf wire type ${wire}`);
	}
}

function uintString(value: bigint): string {
	return value.toString();
}

export function decodeWebcastWebsocketMessage(bytes: Uint8Array): WebcastWebsocketMessage {
	const reader = new ProtoReader(bytes);
	const message: WebcastWebsocketMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 0) message.id = uintString(reader.varint());
		else if (field === 7 && wire === 2) message.type = reader.string();
		else if (field === 8 && wire === 2) message.binary = reader.bytesField();
		else reader.skip(wire);
	}
	return message;
}

export function decodeWebcastResponse(bytes: Uint8Array): WebcastResponse {
	const reader = new ProtoReader(bytes);
	const response: WebcastResponse = { messages: [] };
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) response.messages.push(decodeMessage(reader.bytesField()));
		else reader.skip(wire);
	}
	return response;
}

function decodeMessage(bytes: Uint8Array): WebcastMessage {
	const reader = new ProtoReader(bytes);
	const message: WebcastMessage = { type: '', binary: new Uint8Array() };
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.type = reader.string();
		else if (field === 2 && wire === 2) message.binary = reader.bytesField();
		else reader.skip(wire);
	}
	return message;
}

export function decodeTikTokMessage(type: string, bytes: Uint8Array): DecodedTikTokMessage {
	switch (type) {
		case 'WebcastChatMessage':
			return decodeChatMessage(bytes);
		case 'WebcastEmoteChatMessage':
			return decodeEmoteChatMessage(bytes);
		case 'WebcastGiftMessage':
			return decodeGiftMessage(bytes);
		case 'WebcastLikeMessage':
			return decodeLikeMessage(bytes);
		case 'WebcastMemberMessage':
			return decodeMemberMessage(bytes);
		case 'WebcastSocialMessage':
			return decodeSocialMessage(bytes);
		case 'WebcastSubNotifyMessage':
			return decodeSubscribeMessage(bytes);
		case 'WebcastLiveIntroMessage':
			return decodeIntroMessage(bytes);
		case 'WebcastRoomUserSeqMessage':
			return decodeRoomUserSeqMessage(bytes);
		case 'WebcastControlMessage':
			return decodeControlMessage(bytes);
		default:
			return {};
	}
}

function decodeEvent(bytes: Uint8Array): WebcastMessageEvent {
	const reader = new ProtoReader(bytes);
	const event: WebcastMessageEvent = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 0) event.msgId = uintString(reader.varint());
		else if (field === 4 && wire === 0) event.createTime = uintString(reader.varint());
		else reader.skip(wire);
	}
	return event;
}

function decodeUser(bytes: Uint8Array): User {
	const reader = new ProtoReader(bytes);
	const user: User = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 0) user.userId = uintString(reader.varint());
		else if (field === 3 && wire === 2) user.nickname = reader.string();
		else if (field === 5 && wire === 2) user.bioDescription = reader.string();
		else if (field === 9 && wire === 2) user.profilePicture = decodeProfilePicture(reader.bytesField());
		else if (field === 22 && wire === 2) user.followInfo = decodeFollowInfo(reader.bytesField());
		else if (field === 38 && wire === 2) user.uniqueId = reader.string();
		else if (field === 46 && wire === 2) user.secUid = reader.string();
		else reader.skip(wire);
	}
	return user;
}

function decodeProfilePicture(bytes: Uint8Array): { urls: string[] } {
	const reader = new ProtoReader(bytes);
	const urls: string[] = [];
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) urls.push(reader.string());
		else reader.skip(wire);
	}
	return { urls };
}

function decodeFollowInfo(bytes: Uint8Array): {
	followingCount?: number;
	followerCount?: number;
	followStatus?: number;
} {
	const reader = new ProtoReader(bytes);
	const followInfo: { followingCount?: number; followerCount?: number; followStatus?: number } = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 0) followInfo.followingCount = reader.int32();
		else if (field === 2 && wire === 0) followInfo.followerCount = reader.int32();
		else if (field === 3 && wire === 0) followInfo.followStatus = reader.int32();
		else reader.skip(wire);
	}
	return followInfo;
}

function decodeChatMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.event = decodeEvent(reader.bytesField());
		else if (field === 2 && wire === 2) message.user = decodeUser(reader.bytesField());
		else if (field === 3 && wire === 2) message.comment = reader.string();
		else if (field === 13 && wire === 2) {
			message.emotes ??= [];
			message.emotes.push(decodeSubEmote(reader.bytesField()));
		} else reader.skip(wire);
	}
	return message;
}

function decodeSubEmote(bytes: Uint8Array): NonNullable<DecodedTikTokMessage['emotes']>[number] {
	const reader = new ProtoReader(bytes);
	const emote: NonNullable<DecodedTikTokMessage['emotes']>[number] = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 0) emote.placeInComment = reader.int32();
		else if (field === 2 && wire === 2) emote.emote = decodeEmoteDetails(reader.bytesField());
		else reader.skip(wire);
	}
	return emote;
}

function decodeEmoteDetails(bytes: Uint8Array): { emoteId?: string; image?: { imageUrl?: string } } {
	const reader = new ProtoReader(bytes);
	const emote: { emoteId?: string; image?: { imageUrl?: string } } = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) emote.emoteId = reader.string();
		else if (field === 2 && wire === 2) emote.image = decodeEmoteImage(reader.bytesField());
		else reader.skip(wire);
	}
	return emote;
}

function decodeEmoteImage(bytes: Uint8Array): { imageUrl?: string } {
	const reader = new ProtoReader(bytes);
	const image: { imageUrl?: string } = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) image.imageUrl = reader.string();
		else reader.skip(wire);
	}
	return image;
}

function decodeEmoteChatMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 2) message.user = decodeUser(reader.bytesField());
		else if (field === 3 && wire === 2) message.emote = decodeEmoteDetails(reader.bytesField());
		else reader.skip(wire);
	}
	return message;
}

function decodeGiftMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.event = decodeEvent(reader.bytesField());
		else if (field === 2 && wire === 0) message.giftId = reader.int32();
		else if (field === 5 && wire === 0) message.repeatCount = reader.int32();
		else if (field === 7 && wire === 2) message.user = decodeUser(reader.bytesField());
		else if (field === 9 && wire === 0) message.repeatEnd = reader.int32();
		else if (field === 11 && wire === 0) message.groupId = uintString(reader.varint());
		else if (field === 15 && wire === 2) message.giftDetails = decodeGiftDetails(reader.bytesField());
		else if (field === 23 && wire === 2) message.giftExtra = decodeGiftExtra(reader.bytesField());
		else reader.skip(wire);
	}
	return message;
}

function decodeGiftDetails(bytes: Uint8Array): NonNullable<DecodedTikTokMessage['giftDetails']> {
	const reader = new ProtoReader(bytes);
	const details: NonNullable<DecodedTikTokMessage['giftDetails']> = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) details.giftImage = decodeGiftImage(reader.bytesField());
		else if (field === 2 && wire === 2) details.describe = reader.string();
		else if (field === 11 && wire === 0) details.giftType = reader.int32();
		else if (field === 12 && wire === 0) details.diamondCount = reader.int32();
		else if (field === 16 && wire === 2) details.giftName = reader.string();
		else reader.skip(wire);
	}
	return details;
}

function decodeGiftImage(bytes: Uint8Array): { giftPictureUrl?: string } {
	const reader = new ProtoReader(bytes);
	const image: { giftPictureUrl?: string } = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) image.giftPictureUrl = reader.string();
		else reader.skip(wire);
	}
	return image;
}

function decodeGiftExtra(bytes: Uint8Array): { receiverUserId?: string } {
	const reader = new ProtoReader(bytes);
	const extra: { receiverUserId?: string } = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 8 && wire === 0) extra.receiverUserId = uintString(reader.varint());
		else reader.skip(wire);
	}
	return extra;
}

function decodeLikeMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.event = decodeEvent(reader.bytesField());
		else if (field === 2 && wire === 0) message.likeCount = reader.int32();
		else if (field === 3 && wire === 0) message.totalLikeCount = reader.int32();
		else if (field === 5 && wire === 2) message.user = decodeUser(reader.bytesField());
		else reader.skip(wire);
	}
	return message;
}

function decodeMemberMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.event = decodeEvent(reader.bytesField());
		else if (field === 2 && wire === 2) message.user = decodeUser(reader.bytesField());
		else if (field === 10 && wire === 0) message.actionId = reader.int32();
		else reader.skip(wire);
	}
	return message;
}

function decodeSocialMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) {
			// Field 1 is the Common header. Decode it twice from the same bytes:
			// once for the event envelope (msgId/createTime) and once for the
			// follow/share discriminator at common.displayText.key (1 -> 8 -> 1).
			const common = reader.bytesField();
			message.event = decodeEvent(common);
			message.displayType = decodeDisplayTextKey(common);
		} else if (field === 2 && wire === 2) message.user = decodeUser(reader.bytesField());
		else reader.skip(wire);
	}
	return message;
}

// WebcastSocialMessage.common.displayText.key - the verified follow/share
// discriminator (issue #91). `common` is field 1, `displayText` is field 8
// within it, and `key` is field 1 within displayText.
function decodeDisplayTextKey(common: Uint8Array): string | undefined {
	const commonReader = new ProtoReader(common);
	while (!commonReader.done()) {
		const { field, wire } = commonReader.tag();
		if (field === 8 && wire === 2) {
			const displayText = commonReader.bytesField();
			const displayTextReader = new ProtoReader(displayText);
			while (!displayTextReader.done()) {
				const inner = displayTextReader.tag();
				if (inner.field === 1 && inner.wire === 2) return displayTextReader.string();
				displayTextReader.skip(inner.wire);
			}
			return undefined;
		}
		commonReader.skip(wire);
	}
	return undefined;
}

function decodeSubscribeMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 2) message.event = decodeEvent(reader.bytesField());
		else if (field === 2 && wire === 2) message.user = decodeUser(reader.bytesField());
		else if (field === 4 && wire === 0) message.subMonth = reader.int32();
		else if (field === 5 && wire === 0) message.subscribeType = reader.int32();
		else reader.skip(wire);
	}
	return message;
}

function decodeIntroMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 0) message.id = uintString(reader.varint());
		else if (field === 4 && wire === 2) message.description = reader.string();
		else if (field === 5 && wire === 2) message.user = decodeUser(reader.bytesField());
		else reader.skip(wire);
	}
	return message;
}

function decodeRoomUserSeqMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 2) {
			message.topViewers ??= [];
			message.topViewers.push(decodeTopUser(reader.bytesField()));
		} else if (field === 3 && wire === 0) message.viewerCount = reader.int32();
		else reader.skip(wire);
	}
	return message;
}

function decodeTopUser(bytes: Uint8Array): NonNullable<DecodedTikTokMessage['topViewers']>[number] {
	const reader = new ProtoReader(bytes);
	const topUser: NonNullable<DecodedTikTokMessage['topViewers']>[number] = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 1 && wire === 0) topUser.coinCount = uintString(reader.varint());
		else if (field === 2 && wire === 2) topUser.user = decodeUser(reader.bytesField());
		else reader.skip(wire);
	}
	return topUser;
}

function decodeControlMessage(bytes: Uint8Array): DecodedTikTokMessage {
	const reader = new ProtoReader(bytes);
	const message: DecodedTikTokMessage = {};
	while (!reader.done()) {
		const { field, wire } = reader.tag();
		if (field === 2 && wire === 0) message.action = reader.int32();
		else reader.skip(wire);
	}
	return message;
}
