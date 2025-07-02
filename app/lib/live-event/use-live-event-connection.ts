import { useEffect, useRef } from 'react';
import { liveEventManager } from './live-event-manager.client';
import { useLiveEventStore } from './live-event-store';

export const useLiveEventConnection = (username: string) => {
	const connection = useLiveEventStore((state) => state.connection);
	const componentIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (username) {
			// Register this component with the service
			const componentId = liveEventManager.connect(username);
			componentIdRef.current = componentId;

			console.log(`🎯 Component ${componentId} connected to @${username}`);
		}

		return () => {
			if (componentIdRef.current) {
				liveEventManager.disconnect(componentIdRef.current);
				console.log(`🎯 Component ${componentIdRef.current} disconnected`);
				componentIdRef.current = null;
			}
		};
	}, [username]);

	return {
		reconnect: () => {
			liveEventManager.retry(componentIdRef.current || undefined);
		},
		connection,
	};
};
