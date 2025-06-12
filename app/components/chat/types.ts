import type { FollowerEvent } from './event-viz/follow-event-card';
import type { GiftEvent } from './event-viz/gift-event-card';
import type { JoinEvent } from './event-viz/join-event-card';
import type { MessageEvent } from './event-viz/message-event-card';
import type { ShareEvent } from './event-viz/share-event-card';

export interface GiftCount {
	name: string;
	count: number;
	image: string;
}

export interface User {
	id: string;
	name: string;
	avatar: string;
}

export interface Gift {
	id: string;
	name: string;
	cost: number;
	image: string;
	repeat: number;
}

export type ChatEvent =
	| MessageEvent
	| FollowerEvent
	| ShareEvent
	| GiftEvent
	| JoinEvent;
