import { useTikTokLiveStore } from '~/lib/tiktok-live-store';
import { ViewerCounter } from '../_ui/viewer-counter';

export const TikTokLiveViewerCounter = () => {
	const viewerCount = useTikTokLiveStore((state) => state.viewerCount);
	return <ViewerCounter viewerCount={viewerCount} />;
};
