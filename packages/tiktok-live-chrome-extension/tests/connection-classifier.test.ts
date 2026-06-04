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
		lastEventAt: now - staleThresholdMs,
	}),
	{ status: 'error', reason: 'stale' },
	'Expected LiveEvents to classify as stale when the threshold is reached',
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
		tabIsLive: false,
		everConnectedLive: true,
	}),
	{ status: 'error', reason: 'off-live' },
	'Expected a navigated-away tab after a confirmed-live connection to classify as off-live',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: true,
		debuggerAttached: false,
	}),
	{ status: 'error', reason: 'off-live' },
	'Expected off-live to dominate a debugger detach (interrupted)',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: true,
		lastEventAt: now - staleThresholdMs - 1,
	}),
	{ status: 'error', reason: 'off-live' },
	'Expected off-live to dominate a stale fault',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: true,
		confirmedSocket: false,
	}),
	{ status: 'error', reason: 'off-live' },
	'Expected off-live to dominate the connecting state',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: true,
		online: false,
	}),
	{ status: 'error', reason: 'offline' },
	'Expected offline to dominate off-live (a URL read is untrustworthy offline)',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: false,
	}),
	{ status: 'connected' },
	'Expected a cold non-live tab that never connected to NOT raise off-live',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: false,
		confirmedSocket: false,
		lastEventAt: undefined,
	}),
	{ status: 'connecting' },
	'Expected a cold non-live tab still discovering to stay connecting, not off-live',
);

assertState(
	classifyConnectionState({
		...connectedSignals(),
		tabIsLive: false,
		everConnectedLive: true,
		streamEnded: true,
	}),
	{ status: 'disconnected' },
	'Expected stream end to dominate off-live',
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
		tabIsLive: true,
		everConnectedLive: true,
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
