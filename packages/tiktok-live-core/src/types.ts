export interface UserInfo {
	userId?: string;
	uniqueId?: string;
	secUid?: string;
	nickname?: string;
	avatarUrl?: string;
	bioDescription?: string;
	followingCount?: number;
	followerCount?: number;
	followStatus?: number;
}

export interface EmoteInfo {
	emoteId: string;
	imageUrl?: string;
	placeInComment?: number;
}

export interface TopViewer {
	coinCount?: number;
	user?: UserInfo;
}

export interface ProviderLog {
	id: string;
	ts: number;
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	details?: Record<string, unknown>;
}
