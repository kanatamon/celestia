import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusBar } from '../src/index.js';

describe('StatusBar', () => {
	it('renders formatted counts, username, and live badge', () => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'connected', username: 'celestia' }}
				viewerCount={12345}
				likeCount={987654}
				username="celestia"
			/>,
		);

		expect(html).toContain('12,345');
		expect(html).toContain('987,654');
		expect(html).toContain('celestia');
		expect(html).toContain('Connection state: Live');
	});

	it.each([
		['attaching', 'Starting'],
		['attached', 'Starting'],
		['connecting', 'Starting'],
		['detaching', 'Starting'],
		['disconnecting', 'Starting'],
		['connected', 'Live'],
		['error', 'Interrupted'],
		['detached', 'Stream Ended'],
		['disconnected', 'Stream Ended'],
	] as const)('maps %s to the %s badge label', (status, label) => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status, username: 'celestia' }}
				viewerCount={1}
				likeCount={2}
			/>,
		);

		expect(html).toContain(`Connection state: ${label}`);
	});

	it('hides the badge and shows the username modal trigger while idle', () => {
		const html = renderToString(
			<StatusBar
				connectionState={{ status: 'idle', username: '' }}
				viewerCount={0}
				likeCount={0}
			/>,
		);

		expect(html).toContain('Open Live');
		expect(html).not.toContain('Connection state:');
	});
});
