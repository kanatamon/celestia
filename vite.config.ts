import type { SentryReactRouterBuildOptions } from '@sentry/react-router';
import { reactRouter } from '@react-router/dev/vite';
import { sentryReactRouter } from '@sentry/react-router';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((config) => {
	// Load env file based on `mode` in the current working directory.
	const env = loadEnv(config.mode, process.cwd(), '');

	const sentryConfig: SentryReactRouterBuildOptions = {
		org: env.SENTRY_ORG,
		project: env.SENTRY_PROJECT,
		// An auth token is required for uploading source maps.
		authToken: env.SENTRY_AUTH_TOKEN,
		// ...
	};

	return {
		plugins: [
			reactRouter(),
			tsconfigPaths(),
			sentryReactRouter(sentryConfig, config),
		],
		define: {
			'process.env.SENTRY_DSN': JSON.stringify(env.SENTRY_DSN),
			'process.env.SENTRY_ENVIRONMENT': JSON.stringify(env.SENTRY_ENVIRONMENT),
			'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
			'process.env.SENTRY_DEBUG': JSON.stringify(env.SENTRY_DEBUG),
		},
	};
});
