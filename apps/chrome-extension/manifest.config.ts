import { defineManifest } from '@crxjs/vite-plugin';

export const manifestDefinition = {
	manifest_version: 3,
	name: 'Celestia',
	description: 'TikTok Live companion Side Panel.',
	version: '0.0.0',
	action: {
		default_title: 'Celestia',
	},
	background: {
		service_worker: 'src/background/service-worker.ts',
		type: 'module',
	},
	permissions: ['debugger', 'sidePanel', 'storage', 'tabs'],
	side_panel: {
		default_path: 'src/side-panel/index.html',
	},
} satisfies chrome.runtime.ManifestV3;

export default defineManifest(manifestDefinition);
