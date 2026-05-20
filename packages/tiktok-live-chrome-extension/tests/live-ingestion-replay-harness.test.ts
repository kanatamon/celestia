import { goldenLiveIngestionReplayFixtures } from './golden-live-ingestion-replay-fixtures.js';
import { replayLiveIngestionTrace } from './live-ingestion-replay-harness.js';

for (const fixture of goldenLiveIngestionReplayFixtures) {
	const result = await replayLiveIngestionTrace(JSON.stringify(fixture.trace));

	assertArray(
		result.liveEventTypes,
		fixture.expectedLiveEventTypes,
		`${fixture.name}: expected replay to emit the golden LiveEvent types`,
	);
	for (const expectedTransition of fixture.expectedStateTransitions) {
		if (!result.stateTransitions.includes(expectedTransition)) {
			throw new Error(
				`${fixture.name}: expected replay to observe ConnectionState transition to ${expectedTransition}`,
			);
		}
	}
	if (result.decodeFailures !== fixture.expectedDecodeFailures) {
		throw new Error(
			`${fixture.name}: expected ${fixture.expectedDecodeFailures} decode failures, got ${result.decodeFailures}`,
		);
	}
	if (
		fixture.expectedLiveEventTypes.length > 0 &&
		!result.logs.some((log) => log.message.includes('frame.decode-result'))
	) {
		throw new Error(`${fixture.name}: expected replay to produce decode-result diagnostics`);
	}
	if (
		fixture.trace.events.some(
			(event) =>
				event.kind === 'frame_received' &&
				event.decodeSummary.outcome === 'error' &&
				event.route !== 'unmapped_candidate',
		) &&
		!result.logs.some((log) => log.message.includes('frame.decode-error'))
	) {
		throw new Error(`${fixture.name}: expected replay to produce decode-error diagnostics`);
	}
}

function assertArray<T>(actual: T[], expected: T[], message: string): void {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);
	}
}
