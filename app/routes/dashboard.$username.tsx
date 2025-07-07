import type { Route } from './+types/dashboard.$username';
import { Button, Drawer, Flex, Menu, Space } from 'antd';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import * as Icon from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { DatePicker, getPeriodPresets } from '~/components/date-picker';
import { HotTimeRevenueHeatmap } from '~/components/hot-time-revenue-heatmap';
import { ClientOnly } from '~/lib/client-only';
import { dateRangeFormSchema, dateRangeSchema } from '~/lib/form-validations';
import { LiveInsightsService } from '~/lib/live-insights-service.server';
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
			const thirtyDaysAgo = subDays(startOfDay(now), 29);

			dateRange = {
				from: thirtyDaysAgo,
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
		const data = await LiveInsightsService.getHotTimeRevenueHeatmap({
			streamerUniqueId: username,
			from: validatedDateRange.from,
			to: validatedDateRange.to,
		});

		return {
			data,
			dateRange: validatedDateRange,
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

const DashboardRoute = ({ loaderData: { data } }: Route.ComponentProps) => {
	const { dateRange, setDateRange } = useDateRangeSearchParams();
	const [open, setOpen] = useState(false);

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
					<Flex
						gap={8}
						style={{
							padding: '16px',
						}}
					>
						<Button
							icon={<Icon.Menu />}
							type="text"
							onClick={() => setOpen(true)}
						/>

						<Space
							align="center"
							style={{
								marginLeft: 'auto',
							}}
						>
							<RangePicker
								format={(date: Date) => format(date, 'MMM d, yyyy')}
								presets={getPeriodPresets()}
								maxDate={new Date()}
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
						</Space>
					</Flex>
					<div
						style={{
							flex: 1,
							overflow: 'hidden',
							padding: '0px 16px',
						}}
					>
						<ClientOnly>
							<HotTimeRevenueHeatmap
								key={`${dateRange.from.getTime()}:${dateRange.to.getTime()}`}
								data={data}
							/>
						</ClientOnly>
						{/* <Outlet /> */}
					</div>
				</Flex>
			</div>
			<Drawer
				placement="left"
				onClose={() => setOpen(false)}
				open={open}
				width={256}
				styles={{
					body: {
						padding: 0,
						display: 'flex',
						flexDirection: 'column',
						height: '100%',
					},
					footer: {
						padding: 0,
					},
				}}
				footer={
					<Menu
						mode="inline"
						items={[
							{
								key: 'leave',
								icon: <Icon.LogOut size={20} />,
								label: 'Leave',
								danger: true,
							},
						]}
						style={{
							background: 'transparent',
							boxShadow: 'none',
							backdropFilter: 'none',
						}}
					/>
				}
			>
				<Menu
					mode="inline"
					items={[
						{
							key: 'live-feed',
							icon: <Icon.Radio size={20} />,
							label: 'Live Feed',
						},
						{
							key: 'dashboard',
							icon: <Icon.ChartNoAxesCombined size={20} />,
							label: 'Dashboard',
						},
					]}
					style={{
						background: 'transparent',
						boxShadow: 'none',
						backdropFilter: 'none',
					}}
				/>
			</Drawer>
		</>
	);
};

export default DashboardRoute;
