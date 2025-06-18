import { JoinEventCard } from '~/components/event-viz/join-event-card';
import { useLiveEventStore } from '~/lib/live-event/live-event-store';

export const NewUserJoinEventCard = ({
	style = {},
}: {
	style?: React.CSSProperties;
}) => {
	const joinEvents = useLiveEventStore((state) => state.joinEvents);

	const newJoinEvent = joinEvents.at(-1);
	if (!newJoinEvent) {
		return null;
	}

	return <JoinEventCard event={newJoinEvent} style={style} />;
};
