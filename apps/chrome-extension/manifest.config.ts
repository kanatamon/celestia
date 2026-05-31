import { defineManifest, type ManifestV3Export } from '@crxjs/vite-plugin';

export const manifestDefinition = {
	manifest_version: 3,
	name: 'Celestia',
	description: 'TikTok Live companion Session Tab.',
	version: '0.0.0',
	action: {
		default_title: 'Celestia',
		default_popup: 'src/launcher/index.html',
	},
	background: {
		service_worker: 'src/background/service-worker.ts',
		type: 'module',
	},
	permissions: ['debugger', 'storage', 'tabs'],
	web_accessible_resources: [
		{
			resources: ['src/session-tab/index.html'],
			matches: ['<all_urls>'],
		},
	],
} satisfies ManifestV3Export;

export default defineManifest(manifestDefinition);
