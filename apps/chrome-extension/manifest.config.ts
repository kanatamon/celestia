import { defineManifest, type ManifestV3Export } from '@crxjs/vite-plugin';

export const manifestDefinition = {
	manifest_version: 3,
	name: 'Celestia',
	description: 'TikTok Live companion Session Tab.',
	version: '1.0.1',
	icons: {
		16: 'public/icon-16.png',
		32: 'public/icon-32.png',
		48: 'public/icon-48.png',
		128: 'public/icon-128.png',
	},
	action: {
		default_title: 'Celestia',
		default_popup: 'src/launcher/index.html',
		default_icon: {
			16: 'public/icon-16.png',
			32: 'public/icon-32.png',
			48: 'public/icon-48.png',
			128: 'public/icon-128.png',
		},
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
