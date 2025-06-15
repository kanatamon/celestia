import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { LikeEventBubble } from './event-viz/like-event-bubble';

export const LiveInteractionBubbleSpawnPoint: React.FC<{
	style?: React.CSSProperties;
}> = ({ style = {} }) => {
	const interactionEvents = useTikTokLiveStore(
		(state) => state.interactionEvents,
	);
	const removeInteractionEvent = useTikTokLiveStore(
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
