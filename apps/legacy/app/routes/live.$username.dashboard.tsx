import type { Route } from './+types/live.$username.dashboard';
import { Flex } from 'antd';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { Suspense } from 'react';
import { Await } from 'react-router';
import { z } from 'zod';
import { CenteredMessageOverlay } from '~/components/_ui/centered-message-overlay';
import { DatePicker, getPeriodPresets } from '~/components/date-picker';
import { HotTimeRevenueHeatmap } from '~/components/hot-time-revenue-heatmap';
import { ChatNotification } from '~/lib/chat-notification';
import { ClientOnly } from '~/lib/client-only';
import { dateRangeFormSchema, dateRangeSchema } from '~/lib/form-validations';
import { LiveInsightsService } from '~/lib/live-insights-service.server';
import { NavigationMenu } from '~/lib/navigation/navigation-menu';
import { useDateRangeSearchParams } from '~/lib/use-date-range-search-params';

const { RangePicker } = DatePicker;

export const loader = async ({
	request,
	params: { username },
}: Route.LoaderArgs) => {
	try {
		// Parse URL search parameters
		const url = new URL(request.url);
		const searchParams = {
			from: url.searchParams.get('from'),
			to: url.searchParams.get('to'),
		};

		// Validate search parameters
		const validatedParams = dateRangeFormSchema.parse(searchParams);

		// Determine final date range
		let dateRange: { from: Date; to: Date };

		if (!validatedParams.from || !validatedParams.to) {
			// Use defaults when both are missing
			const now = new Date();
			const svenDaysAgo = subDays(startOfDay(now), 6);

			dateRange = {
				from: svenDaysAgo,
				to: now,
			};
		} else {
			// Use provided dates
			dateRange = {
				from: parseISO(validatedParams.from),
				to: parseISO(validatedParams.to),
			};
		}

		// Final validation of processed date range
		const validatedDateRange = dateRangeSchema.parse(dateRange);

		// Fetch data with validated date range
		const hotTimeRevenueHeatmapData =
			LiveInsightsService.getHotTimeRevenueHeatmap({
				streamerUniqueId: username,
				from: validatedDateRange.from,
				to: validatedDateRange.to,
			});
		const availableDateRange = LiveInsightsService.getAvailableDateRange({
			streamerUniqueId: username,
		});

		return {
			hotTimeRevenueHeatmapData,
			availableDateRange,
		};
	} catch (error) {
		// Handle Zod validation errors
		if (error instanceof z.ZodError) {
			const errorMessages = error.errors.map((err) => err.message).join('; ');
			throw new Response(
				JSON.stringify({
					error: 'Invalid date parameters',
					details: errorMessages,
					issues: error.errors,
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
					},
				},
			);
		}

		// Handle other errors
		console.error('Loader error:', error);
		throw new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: 'Failed to load analytics data',
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	}
};

const DashboardRoute = ({
	loaderData: { hotTimeRevenueHeatmapData, availableDateRange },
}: Route.ComponentProps) => {
	const { dateRange, setDateRange } = useDateRangeSearchParams({
		defaultDays: 7,
	});
	return (
		<>
			<div
				style={{
					backgroundImage: 'url(/background_starry_sky.webp)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					width: '100%',
					height: '100%',
					overflow: 'hidden',
				}}
			>
				<Flex
					vertical
					style={{
						maxWidth: '1024px',
						width: '100%',
						height: '100%',
						margin: '0 auto',
						position: 'relative',
					}}
				>
					<Suspense
						fallback={
							<CenteredMessageOverlay>
								Loading analytics data...
							</CenteredMessageOverlay>
						}
					>
						{/* Navigation */}
						<NavigationMenu>
							<Await resolve={availableDateRange}>
								{(resolvedData) => (
									<RangePicker
										format={(date: Date) => format(date, 'MMM d, yyyy')}
										presets={getPeriodPresets()}
										maxDate={resolvedData.to}
										minDate={resolvedData.from}
										value={[dateRange.from, dateRange.to]}
										onChange={(range) => {
											if (range && range[0] && range[1]) {
												setDateRange({
													from: range[0],
													to: range[1],
												});
											}
										}}
									/>
								)}
							</Await>
						</NavigationMenu>

						{/* Main Content */}
						<div
							style={{
								flex: 1,
								overflow: 'auto',
								padding: '0px 16px',
							}}
						>
							<Await resolve={hotTimeRevenueHeatmapData}>
								{(resolvedData) => (
									<ClientOnly>
										<HotTimeRevenueHeatmap
											key={`${dateRange.from.getTime()}:${dateRange.to.getTime()}`}
											data={resolvedData}
										/>
									</ClientOnly>
								)}
							</Await>
						</div>
					</Suspense>
				</Flex>
			</div>
			<ClientOnly>
				<ChatNotification
					options={{
						enableWhenUserActive: true,
					}}
				/>
			</ClientOnly>
		</>
	);
};

export default DashboardRoute;
