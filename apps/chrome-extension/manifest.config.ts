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
	host_permissions: ['https://*.tiktok.com/*'],
	content_scripts: [
		{
			// Gift Animation Tap (ADR-0006): MAIN-world tap injected before TikTok's
			// code runs so it can patch `Worker.prototype.postMessage` and
			// `URL.createObjectURL` to capture the decrypted gift animation.
			matches: ['https://*.tiktok.com/*'],
			js: ['src/gift-animation-tap/tap-main.ts'],
			run_at: 'document_start' as const,
			world: 'MAIN' as const,
		},
		{
			// Isolated-world relay: bridges captured bytes from the MAIN-world tap
			// (which has no `chrome.*`) to the service worker.
			matches: ['https://*.tiktok.com/*'],
			js: ['src/gift-animation-tap/tap-isolated.ts'],
			run_at: 'document_start' as const,
			world: 'ISOLATED' as const,
		},
	],
	web_accessible_resources: [
		{
			resources: ['src/session-tab/index.html'],
			matches: ['<all_urls>'],
		},
	],
} satisfies ManifestV3Export;

export default defineManifest(manifestDefinition);
