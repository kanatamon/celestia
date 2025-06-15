import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { LikeCounter } from './like-counter';

export const LiveLikeCounter = () => {
	const likeCount = useTikTokLiveStore((state) => state.likeCount);
	return <LikeCounter likeCount={likeCount} />;
};
