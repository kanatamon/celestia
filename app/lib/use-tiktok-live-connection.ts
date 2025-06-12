import { useEffect, useRef } from 'react';
import { tikTokLiveClient } from './tiktok-live-client';
import { useTikTokLiveStore } from './tiktok-live-store';

export const useTikTokLiveConnection = (username: string) => {
	const connection = useTikTokLiveStore((state) => state.connection);
	const componentIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (username) {
			// Register this component with the service
			const componentId = tikTokLiveClient.connect(username);
			componentIdRef.current = componentId;

			console.log(`🎯 Component ${componentId} connected to @${username}`);
		}

		return () => {
			if (componentIdRef.current) {
				tikTokLiveClient.disconnect(componentIdRef.current);
				console.log(`🎯 Component ${componentIdRef.current} disconnected`);
				componentIdRef.current = null;
			}
		};
	}, [username]);

	return {
		reconnect: () => {
			tikTokLiveClient.retry(componentIdRef.current || undefined);
		},
		connection,
	};
};
