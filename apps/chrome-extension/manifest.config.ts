import { defineManifest, type ManifestV3Export } from '@crxjs/vite-plugin';

export const manifestDefinition = {
	manifest_version: 3,
	name: 'Celestia',
	description: 'TikTok Live companion Session Tab.',
	version: '1.1.0',
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
		// NOTE (issue #65): the MAIN-world Gift Animation Tap is intentionally NOT
		// registered here. crxjs wraps every content_scripts entry in an
		// async-`import()` loader, which makes the tap install ~1s late and defeats
		// ADR-0006's "patch before TikTok runs" guarantee. It is instead bundled as a
		// classic IIFE and injected synchronously by the `giftTapClassicInjection`
		// build plugin (apps/chrome-extension/build/gift-tap-classic-injection.ts).
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
