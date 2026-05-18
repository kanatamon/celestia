import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { manifestDefinition } from '../manifest.config.js';
import { SidePanel } from '../src/side-panel/side-panel.js';

describe('Chrome extension scaffold', () => {
	it('declares the Side Panel and background service worker in the MV3 manifest', () => {
		expect(manifestDefinition.manifest_version).toBe(3);
		expect(manifestDefinition.permissions).toContain('sidePanel');
		expect(manifestDefinition.side_panel.default_path).toBe('src/side-panel/index.html');
		expect(manifestDefinition.background.service_worker).toBe('src/background/service-worker.ts');
	});

	it('renders a blank Side Panel landmark for the React entry point', () => {
		const html = renderToString(<SidePanel />);

		expect(html).toContain('aria-label="Celestia Side Panel"');
	});
});
