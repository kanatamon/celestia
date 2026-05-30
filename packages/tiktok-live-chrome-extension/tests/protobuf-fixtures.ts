import { gzipSync } from 'node:zlib';

export function field(fieldNumber: number, wireType: number): Uint8Array {
	return varint(BigInt((fieldNumber << 3) | wireType));
}

export function uint(fieldNumber: number, value: number | bigint): Uint8Array {
	return concat(field(fieldNumber, 0), varint(BigInt(value)));
}

export function str(fieldNumber: number, value: string): Uint8Array {
	return bytes(fieldNumber, new TextEncoder().encode(value));
}

export function bytes(fieldNumber: number, value: Uint8Array): Uint8Array {
	return concat(field(fieldNumber, 2), varint(BigInt(value.length)), value);
}

export function msg(fields: Uint8Array[]): Uint8Array {
	return concat(...fields);
}

export function user(id = 1001): Uint8Array {
	return msg([
		uint(1, id),
		str(3, 'Celestia Viewer'),
		bytes(9, msg([str(1, 'https://example.test/avatar.png')])),
		bytes(22, msg([uint(1, 10), uint(2, 20)])),
		str(38, 'celestia.viewer'),
		str(46, 'sec_uid'),
		str(5, 'watches TikTok Live'),
	]);
}

export function event(msgId: number, createTime = 1_764_288_000_000): Uint8Array {
	return msg([uint(2, msgId), uint(4, createTime)]);
}

export function responseMessage(type: string, binary: Uint8Array): Uint8Array {
	return msg([str(1, type), bytes(2, binary)]);
}

export function frameBase64(messages: Uint8Array[], envelopeType = 'msg', gzip = true): string {
	const response = msg(messages.map((message) => bytes(1, message)));
	const envelope = msg([
		uint(2, 1),
		str(7, envelopeType),
		bytes(8, gzip ? new Uint8Array(gzipSync(response)) : response),
	]);
	return Buffer.from(envelope).toString('base64');
}

export function concat(...chunks: Uint8Array[]): Uint8Array {
	const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
	const output = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}

function varint(value: bigint): Uint8Array {
	const bytes: number[] = [];
	let current = value;
	while (current >= 0x80n) {
		bytes.push(Number((current & 0x7fn) | 0x80n));
		current >>= 7n;
	}
	bytes.push(Number(current));
	return new Uint8Array(bytes);
}
