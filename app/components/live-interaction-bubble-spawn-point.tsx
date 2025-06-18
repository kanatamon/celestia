import { useLiveEventStore } from '~/lib/live-event/live-event-store';
import { LikeEventBubble } from './event-viz/like-event-bubble';

export const LiveInteractionBubbleSpawnPoint: React.FC<{
	style?: React.CSSProperties;
}> = ({ style = {} }) => {
	const interactionEvents = useLiveEventStore(
		(state) => state.interactionEvents,
	);
	const removeInteractionEvent = useLiveEventStore(
		(state) => state.removeInteractionEvent,
	);
	return (
		<div style={style}>
			{interactionEvents.map((event) => (
				<LikeEventBubble
					key={event.id}
					event={event}
					onComplete={() => removeInteractionEvent(event.id)}
				/>
			))}
		</div>
	);
};
