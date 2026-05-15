import { nodeProfilingIntegration } from '@sentry/profiling-node';
import * as Sentry from '@sentry/react-router';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.SENTRY_ENVIRONMENT,
	// Adds request headers and IP for users, for more info visit:
	// https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
	sendDefaultPii: true,

	integrations: [nodeProfilingIntegration()],

	tracesSampleRate: isProduction ? 0.1 : 1.0,
	profilesSampleRate: isProduction ? 0.05 : 0.3,
});
