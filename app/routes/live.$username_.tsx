import type { Route } from './+types/live.$username_';
import { Outlet } from 'react-router';
import { ChatNotification } from '~/lib/chat-notification';
import { ClientOnly } from '~/lib/client-only';
import { useLiveEventConnection } from '~/lib/live-event/use-live-event-connection';
import { NavigationDrawer } from '~/lib/navigation/navigation-drawer';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Live Chat' },
		{
			name: 'description',
			content:
				'View and interact with live stream chat messages in real-time. Follow the conversation and see live reactions from viewers.',
		},
	];
}

export default function LiveLayout({
	params: { username },
}: Route.ComponentProps) {
	useLiveEventConnection(username);
	return (
		<>
			<div
				style={{
					width: '100%',
					height: '100%',
					overflow: 'hidden',
				}}
			>
				<Outlet />
			</div>
			<ClientOnly>
				<NavigationDrawer username={username} />
			</ClientOnly>
		</>
	);
}
