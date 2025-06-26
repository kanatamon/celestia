import {
	differenceInDays,
	differenceInHours,
	differenceInMinutes,
	differenceInMonths,
	differenceInSeconds,
	differenceInWeeks,
	differenceInYears,
	format,
	isToday,
	isYesterday,
} from 'date-fns';

export const formatRelativeTime = (date: Date) => {
	const now = new Date();
	const messageDate = new Date(date);

	if (isToday(messageDate)) {
		const seconds = differenceInSeconds(now, messageDate);
		const minutes = differenceInMinutes(now, messageDate);
		const hours = differenceInHours(now, messageDate);

		if (seconds < 10) return 'now';
		if (seconds < 60) return `${seconds}s`;
		if (minutes < 60) return `${minutes}m`;
		return `${hours}h`;
	}

	if (isYesterday(messageDate)) {
		return 'yesterday';
	}

	const days = differenceInDays(now, messageDate);
	const weeks = differenceInWeeks(now, messageDate);
	const months = differenceInMonths(now, messageDate);
	const years = differenceInYears(now, messageDate);

	if (days < 7) return `${days}d`;
	if (weeks < 4) return `${weeks}w`;
	if (months < 12) return `${months}mo`;
	if (years >= 1) return `${years}y`;

	return format(messageDate, 'MMM d');
};
