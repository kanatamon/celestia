import type { User } from './live-event-types';
import { useLiveEventStore } from './live-event-store';

export const useMessageOwner = (viewerMessageId: string): User | undefined => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	return chatEvents.find((event) => event.id === viewerMessageId);
};
