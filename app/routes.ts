import type { RouteConfig } from '@react-router/dev/routes';
import { index, route } from '@react-router/dev/routes';

export default [
	index('routes/_index.tsx'),
	route('sse/tiktok-live/:username', 'routes/sse.tiktok-live.$username.tsx'),
	route('live', 'routes/live.tsx'),
] satisfies RouteConfig;
