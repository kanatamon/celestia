import { useEffect, useRef } from 'react';
import { liveEventClient } from './live-event-client';
import { useLiveEventStore } from './live-event-store';

export const useLiveEventConnection = (username: string) => {
	const connection = useLiveEventStore((state) => state.connection);
	const componentIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (username) {
			// Register this component with the service
			const componentId = liveEventClient.connect(username);
			componentIdRef.current = componentId;

			console.log(`🎯 Component ${componentId} connected to @${username}`);
		}

		return () => {
			if (componentIdRef.current) {
				liveEventClient.disconnect(componentIdRef.current);
				console.log(`🎯 Component ${componentIdRef.current} disconnected`);
				componentIdRef.current = null;
			}
		};
	}, [username]);

	return {
		reconnect: () => {
			liveEventClient.retry(componentIdRef.current || undefined);
		},
		connection,
	};
};
