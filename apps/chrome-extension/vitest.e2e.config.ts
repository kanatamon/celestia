import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'web-ext',
		include: ['tests/**/*.e2e.test.ts'],
		environmentOptions: {
			'web-ext': {
				path: './dist',
				compiler: 'corepack pnpm build',
			},
		},
	},
});
