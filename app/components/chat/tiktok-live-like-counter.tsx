import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { LikeCounter } from '../_ui/like-counter';

export const TikTokLiveLikeCounter = () => {
	const likeCount = useTikTokLiveStore((state) => state.likeCount);
	return <LikeCounter likeCount={likeCount} />;
};
