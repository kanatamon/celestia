import { gunzipSync, inflateRawSync, inflateSync, unzipSync } from 'node:zlib';
import type { LiveEvent } from '@celestia/tiktok-live-core';
import { hashBytes, normalizeTikTokMessage } from './normalize-tiktok-message.js';
import {
	decodeWebcastResponse,
	decodeWebcastWebsocketMessage,
	type WebcastMessage,
} from './tiktok-live.generated.js';

export interface DecodeWebcastFrameResult {
	events: LiveEvent[];
	envelopeType?: string;
	skipped: boolean;
}

export class DedupWindow {
	private readonly keys = new Set<string>();
	private readonly order: string[] = [];

	constructor(private readonly maxSize = 2000) {}

	seen(key: string): boolean {
		if (this.keys.has(key)) {
			return true;
		}
		this.keys.add(key);
		this.order.push(key);
		while (this.order.length > this.maxSize) {
			const oldest = this.order.shift();
			if (oldest !== undefined) this.keys.delete(oldest);
		}
		return false;
	}

	get size(): number {
		return this.keys.size;
	}
}

export function decodeWebcastFrame(
	payloadData: string,
	dedupWindow = new DedupWindow(),
): DecodeWebcastFrameResult {
	const frame = base64ToBytes(payloadData);
	const envelope = decodeWebcastWebsocketMessage(frame);
	if (envelope.type !== 'msg') {
		return { events: [], envelopeType: envelope.type, skipped: true };
	}
	if (!envelope.binary) {
		throw new Error('Webcast msg envelope did not include binary payload');
	}

	const response = decodeWebcastResponse(decompress(envelope.binary));
	const events: LiveEvent[] = [];
	for (const message of response.messages) {
		const key = dedupKey(message);
		if (dedupWindow.seen(key)) continue;
		events.push(normalizeTikTokMessage(message));
	}
	return { events, envelopeType: envelope.type, skipped: false };
}

function base64ToBytes(payloadData: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(payloadData, 'base64'));
	}
	const binary = atob(payloadData);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decompress(bytes: Uint8Array): Uint8Array {
	const attempts = [gunzipSync, inflateSync, inflateRawSync, unzipSync];
	for (const attempt of attempts) {
		try {
			return new Uint8Array(attempt(bytes));
		} catch {
			// Try the next format before falling back to plain bytes.
		}
	}
	return bytes;
}

function dedupKey(message: WebcastMessage): string {
	const event = normalizeTikTokMessage(message);
	return event.id || `${message.type}:${hashBytes(message.binary)}`;
}
