import type { SentryReactRouterBuildOptions } from '@sentry/react-router';
import { reactRouter } from '@react-router/dev/vite';
import { sentryReactRouter } from '@sentry/react-router';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const sentryConfig: SentryReactRouterBuildOptions = {
	org: process.env.VITE_SENTRY_ORG,
	project: process.env.VITE_SENTRY_PROJECT,
	// An auth token is required for uploading source maps.
	authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
	// ...
};

export default defineConfig((config) => {
	console.log('=== RAILWAY DEBUG INFO ===');
	console.log('Command:', config.command);
	console.log('Mode:', config.mode);
	console.log('NODE_ENV:', process.env.NODE_ENV);
	console.log('Railway Environment:', process.env.RAILWAY_ENVIRONMENT);
	console.log(
		'Available env keys:',
		Object.keys(process.env).filter(
			(key) => key.includes('SENTRY') || key.includes('NODE_ENV'),
		),
	);

	const env = loadEnv(config.mode, process.cwd(), '');
	console.log('Loaded env:', env);
	console.log('=========================');

	return {
		plugins: [
			reactRouter(),
			tsconfigPaths(),
			sentryReactRouter(sentryConfig, config),
		],
	};
});
