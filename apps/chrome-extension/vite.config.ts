import { fileURLToPath, URL } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { giftTapClassicInjection } from './gift-tap-classic-injection.js';
import manifest from './manifest.config.js';

export default defineConfig({
	plugins: [react(), crx({ manifest }), giftTapClassicInjection()],
	build: {
		rollupOptions: {
			input: {
				'session-tab': fileURLToPath(new URL('src/session-tab/index.html', import.meta.url)),
			},
		},
	},
	resolve: {
		alias: {
			'@celestia/tiktok-live-chrome-extension': fileURLToPath(
				new URL('../../packages/tiktok-live-chrome-extension/src/index.ts', import.meta.url),
			),
			'@celestia/tiktok-live-core': fileURLToPath(
				new URL('../../packages/tiktok-live-core/src/index.ts', import.meta.url),
			),
			// More specific subpath alias must precede the bare barrel alias so it
			// wins first. The barrel re-exports DOM/CSS-module components; code
			// reachable from the service worker (user-preferences) imports the pure
			// threshold helper from this DOM-free module to keep the barrel — and its
			// `document`-touching CSS side effects — out of the worker bundle.
			'@celestia/ui/celebration-settings': fileURLToPath(
				new URL('../../packages/ui/src/celebration-settings.ts', import.meta.url),
			),
			'@celestia/ui/like-motion-settings': fileURLToPath(
				new URL('../../packages/ui/src/like-motion-settings.ts', import.meta.url),
			),
			'@celestia/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
		},
	},
	server: {
		cors: {
			origin: [/chrome-extension:\/\//],
		},
		hmr: {
			host: 'localhost',
			clientPort: 5173,
			protocol: 'ws',
		},
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
	},
});
