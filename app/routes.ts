import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
	index('routes/_index.tsx'),
	route('sse/tiktok-live/:username', 'routes/sse.tiktok-live.$username.tsx'),
	layout('routes/_live.tsx', [route('feed', 'routes/_live.feed.tsx')]),
] satisfies RouteConfig;
