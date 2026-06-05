import type { LiveEvent } from '@celestia/tiktok-live-core';
import { decodeWebcastFrame } from '../src/protocol/decode-webcast-frame.js';
import {
	bytes,
	event,
	frameBase64,
	msg,
	responseMessage,
	str,
	uint,
	user,
} from './protobuf-fixtures.js';

const chat = responseMessage(
	'WebcastChatMessage',
	msg([bytes(1, event(1)), bytes(2, user()), str(3, 'hello')]),
);

const heartbeat = decodeWebcastFrame(frameBase64([], 'hb'));
if (!heartbeat.skipped) {
	throw new Error('Expected heartbeat envelope to be skipped');
}
if (heartbeat.events.length !== 0) {
	throw new Error('Expected heartbeat envelope to emit no events');
}

const decoded = decodeWebcastFrame(frameBase64([chat]));
const chatEvent = decoded.events[0];
if (chatEvent?.type !== 'chat') {
	throw new Error('Expected chat event');
}
chatEvent satisfies LiveEvent;
chatEvent.text satisfies string;
if (chatEvent.user?.followStatus !== 1) {
	throw new Error('Expected FollowInfo field 3 to decode and normalize as followStatus');
}

const originalAtob = globalThis.atob;
const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
const originalBuffer = globalWithBuffer.Buffer;
const browserFrame = frameBase64([chat]);
Object.defineProperty(globalThis, 'atob', {
	configurable: true,
	value(this: unknown, payload: string) {
		if (this !== globalThis) {
			throw new Error('Illegal invocation');
		}
		return originalAtob.call(globalThis, payload);
	},
});
Object.defineProperty(globalThis, 'Buffer', {
	configurable: true,
	value: undefined,
});
try {
	const browserDecoded = decodeWebcastFrame(browserFrame);
	if (browserDecoded.events[0]?.type !== 'chat') {
		throw new Error('Expected browser base64 path to decode chat event');
	}
} finally {
	Object.defineProperty(globalThis, 'atob', {
		configurable: true,
		value: originalAtob,
	});
	Object.defineProperty(globalThis, 'Buffer', {
		configurable: true,
		value: originalBuffer,
	});
}

const duplicateFrame = frameBase64([chat, chat]);
const duplicateResult = decodeWebcastFrame(duplicateFrame);
if (duplicateResult.events.length !== 1) {
	throw new Error('Expected duplicate messages in one frame to emit once');
}

const plainResult = decodeWebcastFrame(frameBase64([chat], 'msg', false));
if (plainResult.events.length !== 1) {
	throw new Error('Expected plain WebcastResponse fallback to decode');
}

const cases: Array<[string, Uint8Array, LiveEvent['type']]> = [
	[
		'WebcastEmoteChatMessage',
		msg([bytes(2, user()), bytes(3, msg([str(1, 'heart'), bytes(2, msg([str(1, 'url')]))]))]),
		'emote_chat',
	],
	[
		'WebcastGiftMessage',
		msg([
			bytes(1, event(2)),
			uint(2, 5655),
			uint(5, 3),
			bytes(7, user()),
			uint(9, 1),
			uint(11, 12345),
			bytes(
				15,
				msg([
					bytes(1, msg([str(1, 'https://example.test/rose.png')])),
					str(16, 'Rose'),
					str(2, 'sent a Rose'),
					uint(11, 1),
					uint(12, 1),
				]),
			),
			bytes(23, msg([uint(8, 99)])),
		]),
		'gift',
	],
	[
		'WebcastLikeMessage',
		msg([bytes(1, event(3)), uint(2, 10), uint(3, 100), bytes(5, user())]),
		'like',
	],
	['WebcastMemberMessage', msg([bytes(1, event(4)), bytes(2, user()), uint(10, 52)]), 'member'],
	['WebcastSocialMessage', msg([bytes(1, event(5)), bytes(2, user())]), 'social'],
	[
		'WebcastSubNotifyMessage',
		msg([bytes(1, event(6)), bytes(2, user()), uint(4, 2), uint(5, 1)]),
		'subscribe',
	],
	['WebcastLiveIntroMessage', msg([uint(2, 7), str(4, 'intro'), bytes(5, user())]), 'intro'],
	[
		'WebcastRoomUserSeqMessage',
		msg([bytes(2, msg([uint(1, 12), bytes(2, user())])), uint(3, 123)]),
		'viewer_count',
	],
	['WebcastControlMessage', msg([uint(2, 3)]), 'stream_end'],
	['WebcastUnsupportedMessage', msg([str(1, 'opaque')]), 'unknown'],
];

for (const [type, binary, expectedType] of cases) {
	const result = decodeWebcastFrame(frameBase64([responseMessage(type, binary)]));
	const event = result.events[0];
	if (event?.type !== expectedType) {
		throw new Error(`Expected ${type} to normalize to ${expectedType}`);
	}
	if (type === 'WebcastGiftMessage' && event.type === 'gift' && event.groupId !== '12345') {
		throw new Error('Expected gift events to expose groupId');
	}
}
