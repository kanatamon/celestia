import type { WebcastGiftMessage } from '@prisma/client';
import _ from 'lodash';
import { prisma } from './db.server';

export interface HeatmapDataPoint {
	dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
	hour: number; // 0-23
	totalDiamonds: number;
	sessionCount: number;
	averageDiamonds: number;
}

export interface CalendarDataPoint {
	date: string; // YYYY-MM-DD format
	totalDiamonds: number;
	sessionCount: number;
	averageDiamonds: number;
}

export interface SessionWithRevenue {
	roomId: string;
	createdAt: Date;
	totalDiamonds: number;
	giftCount: number;
}

const getPreviousDate = (): Date => {
	// Default to 24 hours ago for Oracle business context
	return new Date(Date.now() - 24 * 60 * 60 * 1000);
};

const getNowDate = (): Date => {
	// Default to today for Oracle business context
	return new Date();
};

export class LiveInsightsService {
	// static async getViewerTrends(
	// 	dateRange: DateRange = GET_DEFAULT_DATE_RANGE(),
	// ) {
	// 	const rawData = await prisma.webcastRoomUserSeqMessage.findMany({
	// 		where: {
	// 			createdAt: {
	// 				gte: dateRange.from,
	// 				lt: dateRange.to,
	// 			},
	// 		},
	// 		select: {
	// 			createdAt: true,
	// 			viewerCount: true,
	// 		},
	// 		orderBy: { createdAt: 'asc' },
	// 	});

	// 	const aggregated = _(rawData)
	// 		.groupBy((record) => {
	// 			const date = new Date(record.createdAt);
	// 			date.setMinutes(Math.floor(date.getMinutes() / 60) * 60, 0, 0);
	// 			return date.toISOString();
	// 		})
	// 		.map((records, sampling) => ({
	// 			timestamp: new Date(sampling).getTime(),
	// 			maxViewers: _.maxBy(records, 'viewerCount')?.viewerCount || 0,
	// 			minViewers: _.minBy(records, 'viewerCount')?.viewerCount || 0,
	// 			avgViewers: Math.floor(_.meanBy(records, 'viewerCount')),
	// 			dataPoints: records.length,
	// 		}))
	// 		.sortBy('timestamp')
	// 		.value();

	// 	return aggregated;
	// }

	// static async getVisitorTrends(
	// 	dateRange: DateRange = GET_DEFAULT_DATE_RANGE(),
	// ) {
	// 	const rawData = await prisma.webcastMemberMessage.findMany({
	// 		where: {
	// 			createdAt: {
	// 				gte: dateRange.from,
	// 				lt: dateRange.to,
	// 			},
	// 		},
	// 		select: {
	// 			createdAt: true,
	// 			createTime: true,
	// 		},
	// 		orderBy: { createdAt: 'asc' },
	// 	});

	// 	const aggregated = _(rawData)
	// 		.groupBy((record) => {
	// 			// Round to minute
	// 			// const minute = new Date(+record.createTime);
	// 			// minute.setSeconds(0, 0);
	// 			// return minute.toISOString();
	// 			const date = new Date(+record.createTime);
	// 			date.setMinutes(Math.floor(date.getMinutes() / 60) * 60, 0, 0);
	// 			return date.toISOString();
	// 		})
	// 		.map((records, sampling) => ({
	// 			timestamp: new Date(sampling).getTime(),
	// 			visitorCount: records.length,
	// 		}))
	// 		.sortBy('timestamp')
	// 		.value();

	// 	return aggregated;
	// }

	// static async getRevenueTrends(
	// 	dateRange: DateRange = GET_DEFAULT_DATE_RANGE(),
	// ) {
	// 	const gifts = await prisma.webcastGiftMessage.findMany({
	// 		where: {
	// 			createdAt: {
	// 				gte: dateRange.from,
	// 				lt: dateRange.to,
	// 			},
	// 		},
	// 		select: {
	// 			msgId: true,
	// 			groupId: true,
	// 			repeatCount: true,
	// 			diamondCount: true,
	// 			userId: true,
	// 			createTime: true,
	// 		},
	// 	});

	// 	const aggregated = _(gifts)
	// 		// Filter out gifts with zero diamond count
	// 		.map((gift) => ({
	// 			...gift,
	// 			groupId: gift.groupId === '0' ? gift.msgId : gift.groupId,
	// 			createTime: +gift.createTime,
	// 		}))
	// 		.groupBy((gift) => {
	// 			return gift.groupId;
	// 		})
	// 		.map((records) => {
	// 			const finalizedRecords = _.maxBy(records, 'createTime');
	// 			if (!finalizedRecords) {
	// 				return {
	// 					createTime: 0,
	// 					diamondCount: 0,
	// 					repeatCount: 0,
	// 					userId: '',
	// 				};
	// 			}
	// 			return {
	// 				createTime: finalizedRecords.createTime,
	// 				diamondCount:
	// 					finalizedRecords.diamondCount * finalizedRecords.repeatCount,
	// 				userId: finalizedRecords.userId,
	// 			};
	// 		})
	// 		.groupBy((record) => {
	// 			// Round to minute
	// 			// const minute = new Date(gift.createTime);
	// 			// minute.setSeconds(0, 0);
	// 			// return minute.toISOString();
	// 			const date = new Date(record.createTime);
	// 			date.setMinutes(Math.floor(date.getMinutes() / 60) * 60, 0, 0);
	// 			return date.toISOString();
	// 		})
	// 		.map((records, sampling) => ({
	// 			timestamp: new Date(sampling).getTime(),
	// 			totalRevenue: _.sumBy(records, 'diamondCount'),
	// 			giftCount: records.length,
	// 			uniqueGifters: _.uniqBy(records, 'userId').length,
	// 		}))
	// 		.sortBy('timestamp')
	// 		.value();

	// 	return aggregated;
	// }

	static async getSessionRevenues({
		streamerUniqueId,
		from = getPreviousDate(),
		to = getNowDate(),
	}: {
		streamerUniqueId?: string;
		from?: Date;
		to?: Date;
	} = {}): Promise<SessionWithRevenue[]> {
		const sessions = await prisma.webcastLiveIntroMessage.findMany({
			where: {
				streamerUniqueId,
				createdAt: {
					gte: from,
					lte: to,
				},
			},
			include: {
				giftMessages: {
					select: {
						msgId: true,
						groupId: true,
						diamondCount: true,
						repeatCount: true,
					},
				},
			},
			orderBy: {
				createdAt: 'asc',
			},
		});

		return sessions.map((session) => {
			const aggregated = _(session.giftMessages)
				.map((gift) => ({
					...gift,
					groupId: gift.groupId === '0' ? gift.msgId : gift.groupId,
				}))
				.groupBy((gift) => {
					return gift.groupId;
				})
				.map((records) => {
					const finalizedRecords = _.maxBy(records, 'repeatCount');
					if (!finalizedRecords) {
						return {
							totalDiamonds: 0,
							repeatCount: 0,
						};
					}
					return {
						totalDiamonds:
							finalizedRecords.diamondCount * finalizedRecords.repeatCount,
						repeatCount: finalizedRecords.repeatCount,
					};
				});
			return {
				roomId: session.roomId,
				createdAt: session.createdAt,
				totalDiamonds: aggregated.sumBy('totalDiamonds'),
				giftCount: aggregated.sumBy('repeatCount'),
			};
		});
	}

	static async getRevenueGifts({
		streamerUniqueId,
		from = getPreviousDate(),
		to = getNowDate(),
	}: {
		streamerUniqueId?: string;
		from?: Date;
		to?: Date;
	} = {}): Promise<
		(WebcastGiftMessage & {
			totalDiamonds: number;
		})[]
	> {
		const giftMessages = await prisma.webcastGiftMessage.findMany({
			where: {
				createdAt: {
					gte: from,
					lte: to,
				},
				session: {
					streamerUniqueId,
				},
			},
		});

		const aggregated = _(giftMessages)
			.map((gift) => ({
				...gift,
				groupId: gift.groupId === '0' ? gift.msgId : gift.groupId,
			}))
			.groupBy((gift) => {
				return gift.groupId;
			})
			.map((records) => {
				const record = _.maxBy(records, 'repeatCount');
				if (!record) {
					return null;
				}
				return {
					...record,
					totalDiamonds: record.repeatCount * record.diamondCount,
				};
			})
			.filter((record) => !!record);

		return aggregated.value();
	}

	/**
	 * Provides insights into the most profitable hours across different days of the week.
	 */
	static async getHotTimeRevenueHeatmap({
		streamerUniqueId,
		from = getPreviousDate(),
		to = getNowDate(),
	}: {
		streamerUniqueId?: string;
		from?: Date;
		to?: Date;
	} = {}): Promise<HeatmapDataPoint[]> {
		const gifts = await this.getRevenueGifts({
			streamerUniqueId,
			from,
			to,
		});

		// Group sessions by day of week and hour
		const dailyHourlyGiftDistribution = _.groupBy(gifts, (session) => {
			const date = new Date(session.createdAt);
			const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
			const hour = date.getHours(); // 0-23
			return `${dayOfWeek}-${hour}`;
		});

		// Create heatmap data points
		const heatmapData: HeatmapDataPoint[] = [];

		// Initialize all possible combinations (7 days × 24 hours = 168 data points)
		for (let day = 0; day < 7; day++) {
			for (let hour = 0; hour < 24; hour++) {
				const key = `${day}-${hour}`;
				const sessions = dailyHourlyGiftDistribution[key] || [];

				const totalDiamonds = _.sumBy(sessions, 'totalDiamonds');
				const sessionCount = sessions.length;
				const averageDiamonds =
					sessionCount > 0 ? totalDiamonds / sessionCount : 0;

				heatmapData.push({
					dayOfWeek: day,
					hour,
					totalDiamonds,
					sessionCount,
					averageDiamonds,
				});
			}
		}

		return heatmapData;
	}

	/**
	 * Get Calendar Heatmap data (GitHub-style)
	 * Secondary View: Shows daily performance over time
	 */
	static async getCalendarHeatmap({
		streamerUniqueId,
		from = getPreviousDate(),
		to = getNowDate(),
	}: {
		streamerUniqueId?: string;
		from?: Date;
		to?: Date;
	} = {}): Promise<CalendarDataPoint[]> {
		const sessionData = await this.getSessionRevenues({
			streamerUniqueId,
			from,
			to,
		});

		// Group sessions by date (YYYY-MM-DD)
		const groupedByDate = _.groupBy(sessionData, (session) => {
			const date = new Date(session.createdAt);
			return date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
		});

		// Create calendar data points
		const calendarData: CalendarDataPoint[] = [];

		// Get all dates in the range
		const currentDate = new Date(from);
		const endDateTime = to.getTime();

		while (currentDate.getTime() <= endDateTime) {
			const dateStr = currentDate.toISOString().split('T')[0]!;
			const sessions = groupedByDate[dateStr] || [];

			const totalDiamonds = _.sumBy(sessions, 'totalDiamonds');
			const sessionCount = sessions.length;
			const averageDiamonds =
				sessionCount > 0 ? totalDiamonds / sessionCount : 0;

			calendarData.push({
				date: dateStr,
				totalDiamonds,
				sessionCount,
				averageDiamonds,
			});

			// Move to next day
			currentDate.setDate(currentDate.getDate() + 1);
		}

		return calendarData;
	}

	/**
	 * Get hot time insights with recommendations
	 */
	static async getHotTimeInsights({
		streamerUniqueId,
		from = getPreviousDate(),
		to = getNowDate(),
	}: {
		streamerUniqueId?: string;
		from?: Date;
		to?: Date;
	} = {}): Promise<{
		bestHours: Array<{
			dayOfWeek: number;
			hour: number;
			averageDiamonds: number;
		}>;
		bestDays: Array<{
			dayOfWeek: number;
			totalDiamonds: number;
			sessionCount: number;
		}>;
		peakTimeSlot: { dayOfWeek: number; hour: number; totalDiamonds: number };
	}> {
		const heatmapData = await this.getHotTimeRevenueHeatmap({
			streamerUniqueId,
			from,
			to,
		});

		// Find best performing hours (top 10)
		const bestHours = _(heatmapData)
			.filter((d) => d.sessionCount > 0)
			.orderBy(['averageDiamonds'], ['desc'])
			.take(10)
			.value();

		// Aggregate by day of week
		const dayAggregated = _(heatmapData)
			.groupBy('dayOfWeek')
			.map((hours, dayOfWeek) => ({
				dayOfWeek: parseInt(dayOfWeek),
				totalDiamonds: _.sumBy(hours, 'totalDiamonds'),
				sessionCount: _.sumBy(hours, 'sessionCount'),
				averageDiamonds:
					_.meanBy(
						hours.filter((h) => h.sessionCount > 0),
						'averageDiamonds',
					) || 0,
			}))
			.orderBy(['totalDiamonds'], ['desc'])
			.value();

		// Find peak time slot
		const peakTimeSlot = _.maxBy(heatmapData, 'totalDiamonds') || {
			dayOfWeek: 0,
			hour: 0,
			totalDiamonds: 0,
		};

		return {
			bestHours,
			bestDays: dayAggregated,
			peakTimeSlot,
		};
	}

	/**
	 * Utility: Get day name from day of week number
	 */
	static getDayName(dayOfWeek: number): string {
		const days = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
		];
		return days[dayOfWeek] || 'Unknown';
	}
}
