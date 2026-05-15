import type { SentryReactRouterBuildOptions } from '@sentry/react-router';
import { reactRouter } from '@react-router/dev/vite';
import { sentryReactRouter } from '@sentry/react-router';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const sentryConfig: SentryReactRouterBuildOptions = {
	org: process.env.VITE_SENTRY_ORG,
	project: process.env.VITE_SENTRY_PROJECT,
	// An auth token is required for uploading source maps.
	authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
	// ...
};

export default defineConfig((config) => {
	return {
		plugins: [
			reactRouter(),
			tsconfigPaths(),
			sentryReactRouter(sentryConfig, config),
		],
	};
});
