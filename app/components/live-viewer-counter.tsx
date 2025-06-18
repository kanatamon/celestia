import { ViewerCounter } from '~/components/viewer-counter';
import { useLiveEventStore } from '~/lib/live-event/live-event-store';

export const LiveViewerCounter = () => {
	const viewerCount = useLiveEventStore((state) => state.viewerCount);
	return <ViewerCounter viewerCount={viewerCount} />;
};
