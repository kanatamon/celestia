import type { ConnectionState } from '@celestia/tiktok-live-core';
import {
	type ConnectionClassificationSignals,
	classifyConnectionState,
} from '../src/connection-classifier.js';

const now = 10_000;
const staleThresholdMs = 5_000;
const recentEventAt = now - 1_000;

assertState(
	classifyConnectionState({
		...connectedSignals(),
	}),
	{ status: 'connected' },
	'Expected recent LiveEvents on a confirmed socket to be connected',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		online: false,
	}),
	{ status: 'error', reason: 'offline' },
	'Expected offline browser state to classify as offline error',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		lastEventAt: now - staleThresholdMs - 1,
	}),
	{ status: 'error', reason: 'stale' },
	'Expected stale LiveEvents to classify as stale error',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		debuggerAttached: false,
	}),
	{ status: 'error', reason: 'interrupted' },
	'Expected unexpected debugger detach to classify as interrupted error',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		streamEnded: true,
	}),
	{ status: 'disconnected' },
	'Expected stream end to classify as disconnected',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		confirmedSocket: false,
	}),
	{ status: 'connecting' },
	'Expected missing confirmed socket to keep discovery state',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		lastEventAt: undefined,
	}),
	{ status: 'connecting' },
	'Expected missing LiveEvent activity to keep discovery state',
);

function connectedSignals(): ConnectionClassificationSignals {
	return {
		online: true,
		debuggerAttached: true,
		confirmedSocket: true,
		lastEventAt: recentEventAt,
		staleThresholdMs,
		streamEnded: false,
		now,
	};
}

function assertState(
	actual: ReturnType<typeof classifyConnectionState>,
	expected: Pick<ConnectionState, 'status' | 'reason'>,
	message: string,
): void {
	if (actual.status !== expected.status || actual.reason !== expected.reason) {
		throw new Error(`${message}: got ${JSON.stringify(actual)}`);
	}
}
