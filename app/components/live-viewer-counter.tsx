import { ViewerCounter } from '~/components/viewer-counter';
import { useTikTokLiveStore } from '~/lib/tiktok-live-store';

export const LiveViewerCounter = () => {
	const viewerCount = useTikTokLiveStore((state) => state.viewerCount);
	return <ViewerCounter viewerCount={viewerCount} />;
};
