import type { LiveFeedMessage } from '~/lib/live-event-store';
import { X } from 'lucide-react';
import { useLiveEventStore } from '~/lib/live-event-store';
import { cx } from '~/lib/styles';
import { GlassButton } from './_ui/glass-button';
import { ChatFeed } from './chat-feed';

export const LiveChatFeed = ({
	style = {},
	pinnedMessageId,
	onPinnedMessageChange,
}: {
	style?: React.CSSProperties;
	pinnedMessageId?: string | null | undefined;
	onPinnedMessageChange?: (message: LiveFeedMessage | null | undefined) => void;
}) => {
	const chatEvents = useLiveEventStore((state) => state.chatEvents);
	return (
		<ChatFeed
			style={style}
			messages={chatEvents}
			renderMessage={(message, defaultRender) => (
				<>
					{pinnedMessageId === message.id && (
						<div
							style={{
								position: 'absolute',
								inset: 0,
								width: '100%',
								height: '100%',
								borderRadius: '12px 0 0 12px',
								backdropFilter: 'blur(2px)',
								background:
									'radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 223, 0, 0.4) 50%, rgba(255, 255, 255, 0) 100%)',
							}}
						/>
					)}
					{defaultRender}
					{pinnedMessageId === message.id && (
						<GlassButton
							type="text"
							style={{
								position: 'absolute',
								top: '8px',
								right: '8px',
								cursor: 'pointer',
							}}
							icon={<X size={20} />}
							onClick={(e) => {
								e.stopPropagation();
								onPinnedMessageChange?.(null);
							}}
						/>
					)}
				</>
			)}
			onMessageClick={(message, element) => {
				if (pinnedMessageId === message.id) {
					element.previousElementSibling?.scrollIntoView({
						behavior: 'smooth',
						block: 'start',
					});
				} else {
					onPinnedMessageChange?.(message);
				}
			}}
			getMessageStyle={(event) =>
				cx(
					pinnedMessageId === event.id && {
						zIndex: 10,
						position: 'sticky',
						left: 0,
						top: 0,
					},
				)
			}
		/>
	);
};
