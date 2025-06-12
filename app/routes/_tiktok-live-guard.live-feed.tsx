import type { Route } from './+types/_tiktok-live-guard.live-feed';
import invariant from 'tiny-invariant';
import { ChatFeed } from '~/components/chat/chat-feed';

export function clientLoader({ request }: Route.ClientLoaderArgs) {
	const url = new URL(request.url);
	const username = url.searchParams.get('username');
	invariant(
		username,
		`Username is required in the search params. Example: ?username=your_username`,
	);
	return {
		username,
	};
}

export default function LiveRoute({
	loaderData: { username },
}: Route.ComponentProps) {
	return (
		<div
			style={{
				paddingTop: '96px',
				paddingBottom: '96px',
				margin: '0 auto',
				maxWidth: '412px',
				height: '100%',
			}}
		>
			<ChatFeed />
		</div>
	);
}
