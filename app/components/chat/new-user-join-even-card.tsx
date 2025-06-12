import {
	imagineJoinEvent,
	JoinEventCard,
} from '~/components/chat/event-viz/join-event-card';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

export const NewUserJoinEventCard = ({
	style = {},
}: {
	style?: React.CSSProperties;
}) => {
	const joinEvents = useTikTokLiveStore((state) => state.joinEvents);

	const newJoinEvent = joinEvents.at(-1);
	if (!newJoinEvent) {
		return null;
	}

	return <JoinEventCard event={imagineJoinEvent(newJoinEvent)} style={style} />;
};
