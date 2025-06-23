import * as Sentry from '@sentry/react-router';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

if (import.meta.env.VITE_SENTRY_DSN) {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const isProduction = process.env.NODE_ENV === 'production';
	const isDebugMode = import.meta.env.VITE_SENTRY_DEBUG === 'true';

	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
		sendDefaultPii: true,
		integrations: [Sentry.reactRouterTracingIntegration()],

		tracesSampleRate: isProduction ? 0.1 : 1.0,
		profilesSampleRate: isProduction ? 0.05 : 0.3,

		// Update with your actual domains
		tracePropagationTargets: [
			/^\//,
			/^https:\/\/.*\.railway\.app/,
			// Add your API endpoints here
		],

		// Only enable debug in development
		debug: isDebugMode,

		beforeSend(event) {
			// Filter out development noise
			if (isDevelopment && !isDebugMode) {
				// Optional: disable in development unless testing
				return null;
			}
			return event;
		},
	});

	console.log('✅ Sentry initialized from environment variables');
} else {
	console.warn('⚠️ SENTRY_DSN not found in environment variables');
}

// Sentry.init({
// 	dsn: 'https://1773d108906d9b3ab838eb301d1011ba@o4509541811814400.ingest.us.sentry.io/4509541823021056',

// 	// Adds request headers and IP for users, for more info visit:
// 	// https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
// 	sendDefaultPii: true,

// 	integrations: [Sentry.reactRouterTracingIntegration()],
// 	tracesSampleRate: 1.0, //  Capture 100% of the transactions
// 	// Set `tracePropagationTargets` to declare which URL(s) should have trace propagation enabled
// 	tracePropagationTargets: [/^\//, /^https:\/\/yourserver\.io\/api/],
// });

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<HydratedRouter />
		</StrictMode>,
	);
});
