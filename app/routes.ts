import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
	index('./routes/_index.tsx'),
	route('sse/tiktok-live/:username', './routes/sse.tiktok-live.$username.tsx'),
	...prefix('feed/:username', [
		layout('./routes/_live.feed.$username.tsx', [
			layout('./routes/_live.feed.$username._index.tsx', [
				index('./routes/_live.feed.$username._index.index.tsx'),
				route(
					'viewer/:viewerMessageId',
					'./routes/_live.feed.$username._index.viewer.$viewerMessageId.tsx',
				),
			]),
		]),
	]),
] satisfies RouteConfig;
