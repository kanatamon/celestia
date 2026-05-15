import type { ComponentProps } from 'react';
import { DatePicker as BaseDatePicker } from 'antd';
import {
	endOfMonth,
	endOfWeek,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subDays,
	subMonths,
	subWeeks,
} from 'date-fns';
import dateFnsGenerateConfig from 'rc-picker/lib/generate/dateFns';

export const DatePicker = BaseDatePicker.generatePicker<Date>(
	dateFnsGenerateConfig,
);

// Preset period definitions using date-fns
export const getPeriodPresets = (): ComponentProps<
	typeof DatePicker.RangePicker
>['presets'] => {
	const now = new Date();
	const today = startOfDay(now);

	return [
		{ label: 'Today', value: [today, now] },
		{ label: 'Last 7 Days', value: [subDays(today, 6), now] },
		{ label: 'Last 30 Days', value: [subDays(today, 29), now] },
		{ label: 'Last 90 Days', value: [subDays(today, 89), now] },
		{
			label: 'This Week',
			value: [startOfWeek(today, { weekStartsOn: 0 }), now],
		},
		{
			label: 'Last Week',
			value: [
				startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }),
				endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }),
			],
		},
		{ label: 'This Month', value: [startOfMonth(today), now] },
		{
			label: 'Last Month',
			value: [
				startOfMonth(subMonths(today, 1)),
				endOfMonth(subMonths(today, 1)),
			],
		},
	];
};
