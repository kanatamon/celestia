import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
	index('./routes/_index.tsx'),
	route('sse/tiktok-live/:username', './routes/sse.tiktok-live.$username.tsx'),
	...prefix('live/:username', [
		layout('./routes/live.$username_.tsx', [
			route('dashboard', './routes/live.$username.dashboard.tsx'),
			...prefix('feed/:feedId', [
				layout('./routes/live.$username.feed.$feedId_.tsx', [
					index('./routes/live.$username.feed.$feedId._index.tsx'),
					route(
						'messages/:messageId',
						'./routes/live.$username.feed.$feedId.messages.$messageId.tsx',
					),
				]),
			]),
			...prefix('messages', [
				layout('./routes/live.$username.messages_.tsx', [
					index('./routes/live.$username.messages._index.tsx'),
					route(
						':messageId',
						'./routes/live.$username.messages.$messageId.tsx',
					),
				]),
			]),
		]),
	]),
] satisfies RouteConfig;
