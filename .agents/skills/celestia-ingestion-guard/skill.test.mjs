import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillPath = join(dirname(fileURLToPath(import.meta.url)), 'SKILL.md');
const skill = readFileSync(skillPath, 'utf8').toLowerCase();

test('documents Celestia ingestion guard acceptance criteria', () => {
	const requiredPhrases = [
		'chrome extension provider',
		'websocket discovery',
		'protobuf',
		'capture',
		'decode',
		'normalize',
		'dedup',
		'provider state',
		'side panel ingestion',
		'diagnostic/replay infrastructure',
		'user-visible risks',
		'unknown websocket urls',
		'empty decoded frames',
		'provider/decoder',
		'false connected state',
		'missing liveevents',
		'connectionstate',
	];

	for (const phrase of requiredPhrases) {
		assert.ok(skill.includes(phrase), `Expected SKILL.md to include "${phrase}"`);
	}
});
