import { format, isValid, parseISO, startOfDay, subDays } from 'date-fns';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

interface DateRange {
	from: Date;
	to: Date;
}

interface UseDateRangeSearchParamsOptions {
	/** Default number of days for initial range (default: 30) */
	defaultDays?: number;
	/** Search param key for start date (default: 'from') */
	fromParam?: string;
	/** Search param key for end date (default: 'to') */
	toParam?: string;
	/** Date format for URL (default: 'yyyy-MM-dd') */
	urlDateFormat?: string;
}

export const useDateRangeSearchParams = (
	options: UseDateRangeSearchParamsOptions = {},
) => {
	const {
		defaultDays = 30,
		fromParam = 'from',
		toParam = 'to',
		urlDateFormat = 'yyyy-MM-dd',
	} = options;

	const [searchParams, setSearchParams] = useSearchParams();

	// Parse date range from URL
	const dateRangeFromUrl = useMemo((): DateRange => {
		const fromStr = searchParams.get(fromParam);
		const toStr = searchParams.get(toParam);

		// Try to parse dates from URL
		if (fromStr && toStr) {
			try {
				const fromDate = parseISO(fromStr);
				const toDate = parseISO(toStr);

				if (isValid(fromDate) && isValid(toDate) && fromDate <= toDate) {
					return {
						from: fromDate,
						to: toDate,
					};
				}
			} catch (error) {
				console.warn('Invalid date format in URL parameters');
			}
		}

		// Fallback to default range
		const now = new Date();
		const today = startOfDay(now);
		return {
			from: subDays(today, defaultDays - 1),
			to: now,
		};
	}, [searchParams, fromParam, toParam, defaultDays]);

	// Check if URL has date parameters
	const hasDateParams = useMemo(() => {
		return searchParams.has(fromParam) || searchParams.has(toParam);
	}, [searchParams, fromParam, toParam]);

	// Update search params with new date range
	const setDateRange = useCallback(
		(range: DateRange) => {
			setSearchParams(
				(prev) => {
					const newParams = new URLSearchParams(prev);

					// Set date parameters
					newParams.set(fromParam, format(range.from, urlDateFormat));
					newParams.set(toParam, format(range.to, urlDateFormat));

					return newParams;
				},
				{ replace: true },
			); // Use replace to avoid cluttering browser history
		},
		[setSearchParams, fromParam, toParam, urlDateFormat],
	);

	// Clear date-related search params
	const clearDateRange = useCallback(() => {
		setSearchParams((prev) => {
			const newParams = new URLSearchParams(prev);
			newParams.delete(fromParam);
			newParams.delete(toParam);
			return newParams;
		});
	}, [setSearchParams, fromParam, toParam]);

	return {
		dateRange: dateRangeFromUrl,
		setDateRange,
		clearDateRange,
		hasDateParams,
	};
};
