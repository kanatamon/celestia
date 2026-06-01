/**
 * Gift-asset arm filter — the pure decision core of the Gift Animation Tap
 * (ADR-0006). Extracted from the proven tap so its arm/capture/ignore behavior
 * can be unit-tested without a DOM, a Worker, or `URL.createObjectURL`.
 *
 * TikTok decrypts a high-value gift's animation inside a Web Worker, signalled
 * by a worker message carrying `decryptKey === 'pw_revenue_gift_alpha_video'`,
 * then the page main thread turns the plaintext SBS alpha MP4 into a blob via
 * `URL.createObjectURL`. The filter arms on that worker message and captures the
 * next `video/mp4` blob; everything else is ignored. Empirically this is a tight
 * arm→grab with zero false positives (no unarmed mp4 blobs observed).
 */

/** The constant `decryptKey` name TikTok stamps on the gift-decrypt worker message. */
export const GIFT_ANIMATION_DECRYPT_KEY = 'pw_revenue_gift_alpha_video';

/** The MIME type of the decrypted Gift Animation Asset blob. */
export const GIFT_ANIMATION_MIME_TYPE = 'video/mp4';

/**
 * Observations the tap feeds the filter, in page-event order:
 * - `workerMessage`: a payload posted through `Worker.prototype.postMessage`.
 * - `objectCreated`: a `Blob`/`MediaSource` handed to `URL.createObjectURL`,
 *   reduced to its MIME type (`''` when the source is not a typed `Blob`).
 */
export type GiftAssetObservation =
	| { kind: 'workerMessage'; payload: unknown }
	| { kind: 'objectCreated'; mimeType: string };

/**
 * The filter's decision for a single observation:
 * - `arm`: the decrypt signal was seen; capture the next matching blob.
 * - `capture`: this blob is the Gift Animation Asset — read its bytes.
 * - `ignore`: irrelevant to the tap.
 */
export type GiftAssetDecision = 'arm' | 'capture' | 'ignore';

/** Arm state carried between observations. Start from {@link initialArmState}. */
export interface GiftAssetArmState {
	armed: boolean;
}

export const initialArmState: GiftAssetArmState = { armed: false };

export interface GiftAssetFilterResult {
	decision: GiftAssetDecision;
	state: GiftAssetArmState;
}

/**
 * Pure transition: given the current arm state and one observation, return the
 * decision plus the next arm state. Arming is one-shot — a `capture` disarms so
 * unrelated `video/mp4` blobs created later are ignored until the next decrypt
 * signal re-arms the tap.
 */
export function reduceGiftAssetFilter(
	state: GiftAssetArmState,
	observation: GiftAssetObservation,
): GiftAssetFilterResult {
	if (observation.kind === 'workerMessage') {
		if (carriesGiftDecryptKey(observation.payload)) {
			return { decision: 'arm', state: { armed: true } };
		}
		return { decision: 'ignore', state };
	}

	if (state.armed && observation.mimeType === GIFT_ANIMATION_MIME_TYPE) {
		return { decision: 'capture', state: { armed: false } };
	}

	return { decision: 'ignore', state };
}

function carriesGiftDecryptKey(payload: unknown): boolean {
	if (typeof payload !== 'object' || payload === null) {
		return false;
	}

	const decryptKey = (payload as Record<string, unknown>).decryptKey;
	return decryptKey === GIFT_ANIMATION_DECRYPT_KEY;
}
