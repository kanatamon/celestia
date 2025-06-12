import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
	index('routes/_index.tsx'),
	route('sse/tiktok-live/:username', 'routes/sse.tiktok-live.$username.tsx'),
	layout('routes/_tiktok-live-guard.tsx', [
		route('live-feed', 'routes/_tiktok-live-guard.live-feed.tsx'),
	]),
] satisfies RouteConfig;
