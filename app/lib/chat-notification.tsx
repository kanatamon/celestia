import { useChatEvents } from './live-event/use-chat-events';
import { useChatNotifications } from './use-chat-notification';

export const ChatNotification = () => {
	useChatNotifications(useChatEvents());
	return null;
};
