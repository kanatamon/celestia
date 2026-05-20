import type { LiveEvent } from '@celestia/tiktok-live-core';
import { decompressSync, inflateSync } from 'fflate';
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

export interface DecodeWebcastFrameDiagnostic {
	stage: string;
	details: Record<string, unknown>;
}

export interface DecodeWebcastFrameOptions {
	onDiagnostic?: (diagnostic: DecodeWebcastFrameDiagnostic) => void;
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
	options: DecodeWebcastFrameOptions = {},
): DecodeWebcastFrameResult {
	emitDiagnostic(options, 'base64.start', {
		payloadLength: payloadData.length,
		hasGlobalAtob: typeof globalThis.atob === 'function',
		hasBuffer: typeof Buffer !== 'undefined',
	});
	const frame = base64ToBytes(payloadData, options);
	emitDiagnostic(options, 'base64.done', {
		byteLength: frame.length,
		preview: bytesPreview(frame),
	});
	emitDiagnostic(options, 'envelope.start', {});
	const envelope = decodeWebcastWebsocketMessage(frame);
	emitDiagnostic(options, 'envelope.done', {
		id: envelope.id,
		type: envelope.type,
		hasBinary: envelope.binary !== undefined,
		binaryLength: envelope.binary?.length,
		binaryPreview: envelope.binary ? bytesPreview(envelope.binary) : undefined,
	});
	if (envelope.type !== 'msg') {
		return { events: [], envelopeType: envelope.type, skipped: true };
	}
	if (!envelope.binary) {
		throw new Error('Webcast msg envelope did not include binary payload');
	}

	emitDiagnostic(options, 'decompress.start', {
		byteLength: envelope.binary.length,
		preview: bytesPreview(envelope.binary),
	});
	const decompressed = decompress(envelope.binary, options);
	emitDiagnostic(options, 'response.start', {
		byteLength: decompressed.length,
		preview: bytesPreview(decompressed),
	});
	const response = decodeWebcastResponse(decompressed);
	emitDiagnostic(options, 'response.done', {
		messageCount: response.messages.length,
		messageTypes: response.messages.slice(0, 20).map((message) => message.type),
	});
	const events: LiveEvent[] = [];
	for (const message of response.messages) {
		emitDiagnostic(options, 'message.start', {
			type: message.type,
			binaryLength: message.binary.length,
		});
		const key = dedupKey(message);
		const duplicate = dedupWindow.seen(key);
		emitDiagnostic(options, 'message.dedup', {
			type: message.type,
			key,
			duplicate,
		});
		if (duplicate) continue;
		const event = normalizeTikTokMessage(message);
		emitDiagnostic(options, 'message.done', {
			rawType: message.type,
			eventType: event.type,
			eventId: event.id,
		});
		events.push(event);
	}
	return { events, envelopeType: envelope.type, skipped: false };
}

function base64ToBytes(payloadData: string, options: DecodeWebcastFrameOptions): Uint8Array {
	if (typeof globalThis.atob === 'function') {
		emitDiagnostic(options, 'base64.atob.start', {
			method: 'globalThis.atob',
		});
		let binary: string;
		try {
			binary = globalThis.atob(payloadData);
		} catch (error) {
			emitDiagnostic(options, 'base64.atob.failure', {
				error: errorMessage(error),
			});
			throw error;
		}
		emitDiagnostic(options, 'base64.atob.done', {
			binaryLength: binary.length,
		});
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	}

	emitDiagnostic(options, 'base64.buffer.start', {
		method: 'Buffer.from',
	});
	const bytes = new Uint8Array(Buffer.from(payloadData, 'base64'));
	emitDiagnostic(options, 'base64.buffer.done', {
		byteLength: bytes.length,
		preview: bytesPreview(bytes),
	});
	return bytes;
}

function decompress(bytes: Uint8Array, options: DecodeWebcastFrameOptions): Uint8Array {
	try {
		const decompressed = decompressSync(bytes);
		emitDiagnostic(options, 'decompress.done', {
			method: 'decompressSync',
			byteLength: decompressed.length,
			preview: bytesPreview(decompressed),
		});
		return decompressed;
	} catch (error) {
		emitDiagnostic(options, 'decompress.failure', {
			method: 'decompressSync',
			error: errorMessage(error),
		});
		// Try the next format before falling back to plain bytes.
	}

	try {
		const inflated = inflateSync(bytes);
		emitDiagnostic(options, 'decompress.done', {
			method: 'inflateSync',
			byteLength: inflated.length,
			preview: bytesPreview(inflated),
		});
		return inflated;
	} catch (error) {
		emitDiagnostic(options, 'decompress.failure', {
			method: 'inflateSync',
			error: errorMessage(error),
		});
		emitDiagnostic(options, 'decompress.done', {
			method: 'plain',
			byteLength: bytes.length,
			preview: bytesPreview(bytes),
		});
		return bytes;
	}
}

function dedupKey(message: WebcastMessage): string {
	const event = normalizeTikTokMessage(message);
	return event.id || `${message.type}:${hashBytes(message.binary)}`;
}

function emitDiagnostic(
	options: DecodeWebcastFrameOptions,
	stage: string,
	details: Record<string, unknown>,
): void {
	options.onDiagnostic?.({ stage, details });
}

function bytesPreview(bytes: Uint8Array): string {
	return Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
