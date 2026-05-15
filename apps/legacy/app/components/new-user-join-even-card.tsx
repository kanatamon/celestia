import { JoinEventCard } from '~/components/event-viz/join-event-card';
import { useLiveEventStore } from '~/lib/live-event/live-event-store';
import { WaitEventCard } from './event-viz/wait-event-card';

export const NewUserJoinEventCard = ({
	style = {},
}: {
	style?: React.CSSProperties;
}) => {
	const joinEvents = useLiveEventStore((state) => state.joinEvents);

	const newJoinEvent = joinEvents.at(-1);
	if (!newJoinEvent) {
		return <WaitEventCard style={style} />;
	}

	return <JoinEventCard event={newJoinEvent} style={style} />;
};
