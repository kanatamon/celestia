import { isAfter, isBefore, isValid, parseISO, subDays } from 'date-fns';
import { z } from 'zod';

// Zod schema for date string validation
export const dateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
	.refine((dateStr) => {
		const date = parseISO(dateStr);
		return isValid(date);
	}, 'Invalid date')
	.refine((dateStr) => {
		const date = parseISO(dateStr);
		const now = new Date();
		const maxPastDate = subDays(now, 365 * 2); // 2 years ago
		const maxFutureDate = new Date(); // today

		return !isBefore(date, maxPastDate) && !isAfter(date, maxFutureDate);
	}, 'Date must be within the last 2 years and not in the future');

// Schema for URL search parameters
export const dateRangeFormSchema = z
	.object({
		from: z.string().nullish(),
		to: z.string().nullish(),
	})
	.refine(
		(data) => {
			// If both are missing, it's valid (will use defaults)
			if (!data.from && !data.to) {
				return true;
			}

			// If only one is provided, it's invalid
			if (!data.from || !data.to) {
				return false;
			}

			return true;
		},
		{
			message:
				'Both from and to dates must be provided together, or both omitted for defaults',
			path: ['from', 'to'],
		},
	)
	.refine(
		(data) => {
			// Skip validation if using defaults
			if (!data.from || !data.to) {
				return true;
			}

			// Validate individual date formats
			const fromValidation = dateStringSchema.safeParse(data.from);
			const toValidation = dateStringSchema.safeParse(data.to);

			return fromValidation.success && toValidation.success;
		},
		{
			message: 'Invalid date format. Use YYYY-MM-DD format',
		},
	)
	.refine(
		(data) => {
			// Skip validation if using defaults
			if (!data.from || !data.to) {
				return true;
			}

			const fromDate = parseISO(data.from);
			const toDate = parseISO(data.to);

			// from date must be <= to date
			return !isAfter(fromDate, toDate);
		},
		{
			message: 'From date must be earlier than or equal to to date',
		},
	)
	.refine(
		(data) => {
			// Skip validation if using defaults
			if (!data.from || !data.to) {
				return true;
			}

			const fromDate = parseISO(data.from);
			const toDate = parseISO(data.to);

			// Maximum range of 1 year
			const maxRangeDays = 365;
			const diffInMs = toDate.getTime() - fromDate.getTime();
			const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

			return diffInDays <= maxRangeDays;
		},
		{
			message: 'Date range cannot exceed 1 year',
		},
	);

// Processed date range schema
export const dateRangeSchema = z.object({
	from: z.date(),
	to: z.date(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
