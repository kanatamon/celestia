import type { SentryReactRouterBuildOptions } from '@sentry/react-router';
import { reactRouter } from '@react-router/dev/vite';
import { sentryReactRouter } from '@sentry/react-router';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const sentryConfig: SentryReactRouterBuildOptions = {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	// An auth token is required for uploading source maps.
	authToken: process.env.SENTRY_AUTH_TOKEN,
	// ...
};

export default defineConfig((config) => ({
	plugins: [
		reactRouter(),
		tsconfigPaths(),
		sentryReactRouter(sentryConfig, config),
	],
	define: {
		'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN),
		'process.env.SENTRY_ENVIRONMENT': JSON.stringify(
			process.env.SENTRY_ENVIRONMENT,
		),
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
		'process.env.SENTRY_DEBUG': JSON.stringify(process.env.SENTRY_DEBUG),
	},
}));
