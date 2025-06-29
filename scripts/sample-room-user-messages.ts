// Run with: npx tsx scripts/sample-room-user-messages.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SamplingConfig {
	maxRecordsPerMinutePerRoom: number;
	batchSize: number;
	dryRun: boolean;
	samplingStrategy: 'chronological' | 'random' | 'highest_viewer_count';
}

const DEFAULT_CONFIG: SamplingConfig = {
	maxRecordsPerMinutePerRoom: 10,
	batchSize: 1000,
	dryRun: true, // Safety first!
	samplingStrategy: 'chronological',
};

// Helper function to create minute bucket key
function getMinuteBucket(date: Date): string {
	const truncated = new Date(date);
	truncated.setSeconds(0, 0); // Remove seconds and milliseconds
	return truncated.toISOString();
}

// Helper function to group records by minute and roomId
function groupRecordsByMinuteAndRoom(records: any[]) {
	const groups = new Map<string, any[]>();

	for (const record of records) {
		const minuteBucket = getMinuteBucket(record.createdAt);
		const key = `${record.roomId}:${minuteBucket}`;

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(record);
	}

	return groups;
}

// Helper function to select records to keep based on strategy
function selectRecordsToKeep(
	records: any[],
	maxCount: number,
	strategy: SamplingConfig['samplingStrategy'],
): any[] {
	let sorted: any[];

	switch (strategy) {
		case 'chronological':
			sorted = records.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
			break;
		case 'random':
			sorted = records.sort(() => Math.random() - 0.5);
			break;
		case 'highest_viewer_count':
			sorted = records.sort((a, b) => {
				// Sort by viewer count desc, then by createdAt asc for tie-breaking
				if (b.viewerCount !== a.viewerCount) {
					return b.viewerCount - a.viewerCount;
				}
				return a.createdAt.getTime() - b.createdAt.getTime();
			});
			break;
		default:
			sorted = records;
	}

	return sorted.slice(0, maxCount);
}

async function analyzeCurrentData() {
	console.log('🔍 Analyzing current data distribution...\n');

	// Get total count
	const totalRecords = await prisma.webcastRoomUserSeqMessage.count();
	console.log(`📊 Total records: ${totalRecords.toLocaleString()}`);

	// Get date range
	const [oldest, newest] = await Promise.all([
		prisma.webcastRoomUserSeqMessage.findFirst({
			orderBy: { createdAt: 'asc' },
			select: { createdAt: true },
		}),
		prisma.webcastRoomUserSeqMessage.findFirst({
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true },
		}),
	]);

	console.log(
		`📅 Date range: ${oldest?.createdAt.toISOString()} → ${newest?.createdAt.toISOString()}`,
	);

	// Sample distribution check (last 24 hours)
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentRecords = await prisma.webcastRoomUserSeqMessage.findMany({
		where: {
			createdAt: { gte: oneDayAgo },
		},
		select: {
			id: true,
			roomId: true,
			createdAt: true,
			viewerCount: true,
		},
	});

	const groups = groupRecordsByMinuteAndRoom(recentRecords);
	const oversizedGroups = Array.from(groups.entries())
		.filter(([_, records]) => records.length > 10)
		.sort(([_, a], [__, b]) => b.length - a.length);

	console.log(
		`\n📈 Recent data (last 24h): ${recentRecords.length.toLocaleString()} records`,
	);
	console.log(`🗂️  Total minute-room groups: ${groups.size.toLocaleString()}`);
	console.log(
		`⚠️  Groups with >10 records: ${oversizedGroups.length.toLocaleString()}`,
	);

	if (oversizedGroups.length > 0) {
		console.log('\n🔝 Top 5 oversized groups:');
		oversizedGroups.slice(0, 5).forEach(([key, records]) => {
			const [roomId, minute] = key.split(':');
			console.log(`   ${roomId} @ ${minute}: ${records.length} records`);
		});
	}

	return { totalRecords, oversizedGroupsCount: oversizedGroups.length };
}

async function estimateDeletions(config: SamplingConfig) {
	console.log('\n🧮 Estimating deletions...');

	// Process in chunks to avoid memory issues
	let totalToDelete = 0;
	let offset = 0;
	const chunkSize = 10000;

	while (true) {
		const chunk = await prisma.webcastRoomUserSeqMessage.findMany({
			skip: offset,
			take: chunkSize,
			select: {
				id: true,
				roomId: true,
				createdAt: true,
				viewerCount: true,
			},
			orderBy: { createdAt: 'asc' },
		});

		if (chunk.length === 0) break;

		const groups = groupRecordsByMinuteAndRoom(chunk);

		for (const [_, records] of groups) {
			if (records.length > config.maxRecordsPerMinutePerRoom) {
				const toKeep = selectRecordsToKeep(
					records,
					config.maxRecordsPerMinutePerRoom,
					config.samplingStrategy,
				);
				totalToDelete += records.length - toKeep.length;
			}
		}

		offset += chunkSize;
		process.stdout.write(`\r   Processed: ${offset.toLocaleString()} records`);
	}

	console.log(`\n📉 Estimated deletions: ${totalToDelete.toLocaleString()}`);
	return totalToDelete;
}

async function performSampling(config: SamplingConfig) {
	console.log(
		`\n🎯 Starting sampling with strategy: ${config.samplingStrategy}`,
	);
	console.log(`📦 Batch size: ${config.batchSize}`);
	console.log(`${config.dryRun ? '🧪 DRY RUN MODE' : '⚠️  LIVE MODE'}`);

	let totalDeleted = 0;
	let offset = 0;
	const chunkSize = 5000; // Smaller chunks for processing

	while (true) {
		const chunk = await prisma.webcastRoomUserSeqMessage.findMany({
			skip: offset,
			take: chunkSize,
			select: {
				id: true,
				roomId: true,
				createdAt: true,
				viewerCount: true,
			},
			orderBy: { createdAt: 'asc' },
		});

		if (chunk.length === 0) break;

		const groups = groupRecordsByMinuteAndRoom(chunk);
		const idsToDelete: string[] = [];

		for (const [key, records] of groups) {
			if (records.length > config.maxRecordsPerMinutePerRoom) {
				const toKeep = selectRecordsToKeep(
					records,
					config.maxRecordsPerMinutePerRoom,
					config.samplingStrategy,
				);
				const keepIds = new Set(toKeep.map((r) => r.id));
				const toDelete = records.filter((r) => !keepIds.has(r.id));
				idsToDelete.push(...toDelete.map((r) => r.id));
			}
		}

		// Delete in batches
		if (idsToDelete.length > 0 && !config.dryRun) {
			for (let i = 0; i < idsToDelete.length; i += config.batchSize) {
				const batch = idsToDelete.slice(i, i + config.batchSize);
				await prisma.webcastRoomUserSeqMessage.deleteMany({
					where: {
						id: { in: batch },
					},
				});
				totalDeleted += batch.length;

				// Progress indicator
				process.stdout.write(
					`\r   Deleted: ${totalDeleted.toLocaleString()} records`,
				);
			}
		} else if (config.dryRun) {
			totalDeleted += idsToDelete.length;
			process.stdout.write(
				`\r   Would delete: ${totalDeleted.toLocaleString()} records`,
			);
		}

		offset += chunkSize;
	}

	console.log(
		`\n✅ ${config.dryRun ? 'Would delete' : 'Deleted'}: ${totalDeleted.toLocaleString()} records`,
	);
	return totalDeleted;
}

async function verifyResults() {
	console.log('\n🔍 Verifying results...');

	// Check for any groups with more than 10 records
	const recentRecords = await prisma.webcastRoomUserSeqMessage.findMany({
		where: {
			createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
		},
		select: {
			id: true,
			roomId: true,
			createdAt: true,
		},
	});

	const groups = groupRecordsByMinuteAndRoom(recentRecords);
	const oversizedGroups = Array.from(groups.entries()).filter(
		([_, records]) => records.length > 10,
	);

	if (oversizedGroups.length === 0) {
		console.log('✅ Verification passed: No groups have more than 10 records');
	} else {
		console.log(
			`❌ Verification failed: ${oversizedGroups.length} groups still have >10 records`,
		);
		oversizedGroups.slice(0, 3).forEach(([key, records]) => {
			console.log(`   ${key}: ${records.length} records`);
		});
	}

	// Final stats
	const finalCount = await prisma.webcastRoomUserSeqMessage.count();
	console.log(`📊 Final record count: ${finalCount.toLocaleString()}`);

	return oversizedGroups.length === 0;
}

async function main() {
	try {
		console.log('🚀 WebcastRoomUserSeqMessage Sampling Script\n');

		// Parse command line arguments
		const args = process.argv.slice(2);
		const config: SamplingConfig = { ...DEFAULT_CONFIG };

		if (args.includes('--live')) {
			config.dryRun = false;
		}
		if (args.includes('--random')) {
			config.samplingStrategy = 'random';
		}
		if (args.includes('--highest-viewer')) {
			config.samplingStrategy = 'highest_viewer_count';
		}

		const maxPerMinuteArg = args.find((arg) =>
			arg.startsWith('--max-per-minute='),
		);
		if (maxPerMinuteArg) {
			config.maxRecordsPerMinutePerRoom = parseInt(
				maxPerMinuteArg.split('=')[1] ||
					DEFAULT_CONFIG.maxRecordsPerMinutePerRoom.toString(),
			);
		}

		const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
		if (batchSizeArg) {
			config.batchSize = parseInt(
				batchSizeArg.split('=')[1] || DEFAULT_CONFIG.batchSize.toString(),
			);
		}

		console.log('⚙️  Configuration:');
		console.log(
			`   Max per minute per room: ${config.maxRecordsPerMinutePerRoom}`,
		);
		console.log(`   Sampling strategy: ${config.samplingStrategy}`);
		console.log(`   Batch size: ${config.batchSize}`);
		console.log(`   Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}\n`);

		// Step 1: Analyze current data
		const { totalRecords } = await analyzeCurrentData();

		if (totalRecords === 0) {
			console.log('No records found. Exiting.');
			return;
		}

		// Step 2: Estimate deletions
		const estimatedDeletions = await estimateDeletions(config);

		if (estimatedDeletions === 0) {
			console.log(
				'✅ No sampling needed. All groups already have ≤10 records.',
			);
			return;
		}

		// Step 3: Confirm before proceeding (if live mode)
		if (!config.dryRun) {
			console.log('\n⚠️  WARNING: You are about to permanently delete data!');
			console.log(
				`   Records to delete: ${estimatedDeletions.toLocaleString()}`,
			);
			console.log(
				'   Press Ctrl+C to cancel, or wait 10 seconds to continue...',
			);

			await new Promise((resolve) => setTimeout(resolve, 10000));
			console.log('   Proceeding with deletion...');
		}

		// Step 4: Perform sampling
		const actualDeletions = await performSampling(config);

		// Step 5: Verify results (only if live mode)
		if (!config.dryRun) {
			const isValid = await verifyResults();
			if (!isValid) {
				console.log('⚠️  Verification failed. Please check your data.');
			}
		}

		console.log('\n🎉 Sampling completed successfully!');

		if (config.dryRun) {
			console.log(
				'\n💡 To run for real, use: npx tsx scripts/sample-room-user-messages.ts --live',
			);
		}
	} catch (error) {
		console.error('❌ Error occurred:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { main as sampleRoomUserMessages };
