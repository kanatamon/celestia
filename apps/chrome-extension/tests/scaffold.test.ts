import { describe, expect, it } from 'vitest';
import { manifestDefinition } from '../manifest.config.js';

describe('Chrome extension scaffold', () => {
	it('declares the Launcher, Session Tab, and background service worker in the MV3 manifest', () => {
		const resources = manifestDefinition.web_accessible_resources?.flatMap(
			(entry) => entry.resources,
		);

		expect(manifestDefinition.manifest_version).toBe(3);
		expect(manifestDefinition.action.default_popup).toBe('src/launcher/index.html');
		expect(manifestDefinition.background.service_worker).toBe('src/background/service-worker.ts');
		expect(manifestDefinition.permissions).toEqual(['debugger', 'storage', 'tabs']);
		expect(manifestDefinition).not.toHaveProperty('side_panel');
		expect(resources).toContain('src/session-tab/index.html');
	});
});
