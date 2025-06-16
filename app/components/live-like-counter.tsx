import { useLiveEventStore } from '~/lib/live-event-store';
import { LikeCounter } from './like-counter';

export const LiveLikeCounter = () => {
	const likeCount = useLiveEventStore((state) => state.likeCount);
	return <LikeCounter likeCount={likeCount} />;
};
