import type { LiveInsightsService } from '~/lib/live-insights-service.server';
import { Flex, Popover, Space, Typography } from 'antd';
import _ from 'lodash';
import { useMemo } from 'react';
import {
	ChartTooltip,
	Heatmap,
	HeatmapCell,
	HeatmapSeries,
	LinearXAxis,
	LinearXAxisTickLabel,
	LinearXAxisTickSeries,
	LinearYAxis,
	LinearYAxisTickSeries,
} from 'reaviz';
import { AspectRatio } from '~/components/_ui/aspect-ratio';

const { Text, Title } = Typography;

const REVENUE_COLOR_SCHEMA = [
	{
		fill: 'rgba(255, 245, 157, 1)',
		filter: 'drop-shadow(0px 0px 5px #FFF59D)',
	},
	{
		fill: 'rgba(255, 204, 2, 1)',
		filter: 'drop-shadow(0px 0px 5px #FFCC02)',
	},
	{
		fill: 'rgba(255, 143, 0, 1)',
		filter: 'drop-shadow(0px 0px 5px #FF8F00)',
	},
	{
		fill: 'rgba(255, 109, 0, 1)',
		filter: 'drop-shadow(0px 0px 5px #FF6D00)',
	},
	{
		fill: 'rgba(216,67,21, 1)',
		filter: 'drop-shadow(0px 0px 5px #D84315)',
	},
];

const getDayName = (dayOfWeek: number): string => {
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return days[dayOfWeek] || 'Unknown';
};

export const HotTimeRevenueHeatmap = ({
	data,
	style = {},
}: {
	data: Awaited<
		ReturnType<typeof LiveInsightsService.getHotTimeRevenueHeatmap>
	>;
	style?: React.CSSProperties;
}) => {
	const heatmapData = useMemo(() => {
		// Create full 7x24 matrix
		const matrix = [];
		for (let hour = 0; hour < 24; hour++) {
			const dayItem: {
				key: string;
				data: { key: string; data: number | undefined }[];
			} = {
				key: `${hour.toString().padStart(2, '0')}:00`,
				data: [],
			};
			matrix.push(dayItem);
			for (let day = 0; day < 7; day++) {
				const dataPoint = data.find(
					(d) => d.dayOfWeek === day && d.hour === hour,
				);
				dayItem.data.unshift({
					key: getDayName(day),
					data: dataPoint?.totalDiamonds || undefined,
				});
			}
		}
		return matrix;
	}, [data]);

	const minTotalDiamonds =
		_.min(heatmapData.flatMap((d) => d.data.map((dd) => dd.data))) ?? 0;
	const maxTotalDiamonds =
		_.max(heatmapData.flatMap((d) => d.data.map((dd) => dd.data))) ?? 0;

	return (
		<div style={style}>
			<Flex
				style={{
					paddingRight: 16,
					marginBottom: 8,
				}}
			>
				<Title
					level={3}
					style={{
						width: 'fit-content',
						background: 'linear-gradient(135deg, #FF5733, #FFC300)',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						fontWeight: 'bold',
						textShadow:
							'0 0 10px rgba(255, 87, 51, 0.5), 0 0 20px rgba(255, 87, 51, 0.3)',
					}}
				>
					Hot Time Heatmap
				</Title>
				<Popover
					content={`From ${minTotalDiamonds.toLocaleString()} to ${maxTotalDiamonds.toLocaleString()} diamonds`}
				>
					<Space
						style={{
							fontSize: 11,
							color: 'rgba(255, 255, 255, 0.8)',
							marginLeft: 'auto',
						}}
					>
						<Text
							style={{
								fontSize: 'inherit',
								color: 'inherit',
							}}
						>
							Less
						</Text>
						<div
							style={{
								borderRadius: '2px',
								height: '20px',
								width: '135px',
								background: `linear-gradient(to right, ${REVENUE_COLOR_SCHEMA.map(
									(color) => color.fill,
								).join(', ')})`,
							}}
						/>

						<Text
							style={{
								fontSize: 'inherit',
								color: 'inherit',
							}}
						>
							More
						</Text>
					</Space>
				</Popover>
			</Flex>
			<AspectRatio ratio={24 / 7}>
				<Heatmap
					// @ts-ignore
					data={heatmapData}
					yAxis={
						<LinearYAxis
							axisLine={null}
							tickSeries={
								<LinearYAxisTickSeries
									label={<LinearXAxisTickLabel padding={10} />}
									line={null}
								/>
							}
						/>
					}
					xAxis={
						<LinearXAxis
							axisLine={null}
							tickSeries={
								<LinearXAxisTickSeries
									line={null}
									label={<LinearXAxisTickLabel padding={10} />}
									tickSize={30}
								/>
							}
						/>
					}
					series={
						<HeatmapSeries
							emptyColor="rgba(0, 0, 0, 0.05)"
							cell={
								<HeatmapCell
									// Silent `Uncaught TypeError: onMouseEnter is not a function` due to Reaviz
									onMouseEnter={() => {}}
									// Silent `Uncaught TypeError: onMouseLeave is not a function` due to Reaviz
									onMouseLeave={() => {}}
									tooltip={
										<ChartTooltip
											content={(d: {
												data: { key: string; x: string; value?: number };
											}) => (
												<div
													style={{
														background: 'rgba(0, 0, 0, 0.8)',
														color: '#fff',
														padding: '8px',
														borderRadius: '6px',
														fontSize: '14px',
														position: 'relative',
													}}
												>
													{d.data.value
														? `${d.data.value.toLocaleString()} diamonds on ${d.data.x}, ${d.data.key}`
														: `No data on ${d.data.x}, ${d.data.key}`}
													<div
														style={{
															position: 'absolute',
															bottom: '-8px',
															left: '50%',
															transform: 'translateX(-50%)',
															width: '0',
															height: '0',
															borderLeft: '8px solid transparent',
															borderRight: '8px solid transparent',
															borderTop: '8px solid rgba(0, 0, 0, 0.8)',
														}}
													/>
												</div>
											)}
										/>
									}
								/>
							}
							colorScheme={REVENUE_COLOR_SCHEMA}
						/>
					}
				/>
			</AspectRatio>
		</div>
	);
};
