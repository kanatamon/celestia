import type { UseChatNotificationsOptions } from './use-chat-notification';
import { useChatEvents } from './live-event/use-chat-events';
import { useChatNotifications } from './use-chat-notification';

export const ChatNotification = ({
	options,
}: {
	options?: UseChatNotificationsOptions;
}) => {
	useChatNotifications(useChatEvents(), options);
	return null;
};
