import { useState } from 'react';
import { EarningGiftsParadeEventCard } from './earning-gifts-parade-event-card';
import { NewUserJoinEventCard } from './new-user-join-even-card';

export const ActivityEventSwitch: React.FC<{
	style?: React.CSSProperties;
}> = ({ style = {} }) => {
	const activityEvents = [
		<NewUserJoinEventCard key="join-event" />,
		<EarningGiftsParadeEventCard key="gifts-parade" />,
	];
	const [activeIndex, setActiveIndex] = useState(
		activityEvents.length > 0 ? 0 : -1,
	);
	return (
		<div
			onClick={() =>
				setActiveIndex((prev) => (prev + 1) % activityEvents.length)
			}
			style={{ cursor: 'pointer', width: '100%', ...style }}
		>
			{activityEvents[activeIndex]}
		</div>
	);
};
