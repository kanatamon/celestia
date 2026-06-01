import {
	GIFT_ANIMATION_DECRYPT_KEY,
	GIFT_ANIMATION_MIME_TYPE,
	type GiftAssetArmState,
	type GiftAssetDecision,
	type GiftAssetObservation,
	initialArmState,
	reduceGiftAssetFilter,
} from '../src/chrome-extension/gift-asset-arm-filter.js';

const decryptMessage: GiftAssetObservation = {
	kind: 'workerMessage',
	payload: { decryptKey: GIFT_ANIMATION_DECRYPT_KEY, url: 'https://cdn.example/abc.zip' },
};
const mp4Blob: GiftAssetObservation = { kind: 'objectCreated', mimeType: GIFT_ANIMATION_MIME_TYPE };

// Arms on the decrypt worker message.
assertDecision([decryptMessage], 'arm', 'Expected the decrypt-key worker message to arm the tap');

// Captures the next video/mp4 blob once armed.
assertDecision(
	[decryptMessage, mp4Blob],
	'capture',
	'Expected the first video/mp4 blob after arming to be captured',
);

// Ignores an mp4 blob that arrives before any arm — no false positive.
assertDecision(
	[mp4Blob],
	'ignore',
	'Expected an unarmed video/mp4 blob to be ignored (no false positive)',
);

// Ignores unrelated worker messages.
assertDecision(
	[{ kind: 'workerMessage', payload: { decryptKey: 'something_else' } }],
	'ignore',
	'Expected a worker message without the gift decrypt key to be ignored',
);
assertDecision(
	[{ kind: 'workerMessage', payload: 'not-an-object' }],
	'ignore',
	'Expected a non-object worker message to be ignored',
);
assertDecision(
	[{ kind: 'workerMessage', payload: null }],
	'ignore',
	'Expected a null worker message payload to be ignored',
);

// Ignores non-mp4 blobs even while armed.
assertDecision(
	[decryptMessage, { kind: 'objectCreated', mimeType: 'image/png' }],
	'ignore',
	'Expected a non-mp4 blob while armed to be ignored',
);

// Arming is one-shot: a second mp4 blob after capture is ignored until re-armed.
assertDecisionSequence(
	[decryptMessage, mp4Blob, mp4Blob],
	['arm', 'capture', 'ignore'],
	'Expected arming to disarm after capture so later mp4 blobs are ignored',
);

// Re-arms cleanly for a subsequent gift.
assertDecisionSequence(
	[decryptMessage, mp4Blob, decryptMessage, mp4Blob],
	['arm', 'capture', 'arm', 'capture'],
	'Expected the tap to re-arm and capture again on the next gift',
);

function runFilter(observations: GiftAssetObservation[]): GiftAssetDecision[] {
	let state: GiftAssetArmState = initialArmState;
	const decisions: GiftAssetDecision[] = [];
	for (const observation of observations) {
		const result = reduceGiftAssetFilter(state, observation);
		decisions.push(result.decision);
		state = result.state;
	}
	return decisions;
}

function assertDecision(
	observations: GiftAssetObservation[],
	expected: GiftAssetDecision,
	message: string,
): void {
	const decisions = runFilter(observations);
	const actual = decisions[decisions.length - 1];
	if (actual !== expected) {
		throw new Error(`${message}: got ${actual}`);
	}
}

function assertDecisionSequence(
	observations: GiftAssetObservation[],
	expected: GiftAssetDecision[],
	message: string,
): void {
	const decisions = runFilter(observations);
	if (decisions.length !== expected.length || decisions.some((d, i) => d !== expected[i])) {
		throw new Error(`${message}: got ${JSON.stringify(decisions)}`);
	}
}
