export interface RateLimitConfig {
	maxPerMinute?: number;
	maxPerHour?: number;
	batchSize?: number;
	batchTimeoutMs?: number;
	alwaysAllow?: boolean; // Skip rate limiting entirely
}

export interface RateLimitStats {
	minuteCount: number;
	hourCount: number;
	pendingBatch?: number;
}

export class RateLimiter<TEventType extends string = string> {
	private eventCounts = new Map<
		string,
		{
			minute: number;
			hour: number;
			lastResetMinute: number;
			lastResetHour: number;
		}
	>();

	private pendingBatches = new Map<
		string,
		{
			events: Array<() => Promise<void>>;
			timeout?: NodeJS.Timeout;
		}
	>();

	constructor(
		private config: Record<TEventType, RateLimitConfig>,
		private namespace: string = 'default',
	) {}

	async shouldAllowOperation(
		eventType: TEventType,
		identifier: string,
	): Promise<boolean> {
		const config = this.config[eventType];

		// Always allow if configured
		if (config?.alwaysAllow) {
			return true;
		}

		// If no config exists, allow by default
		if (!config) {
			return true;
		}

		const key = `${this.namespace}:${eventType}:${identifier}`;
		const now = Date.now();
		const currentMinute = Math.floor(now / 60000);
		const currentHour = Math.floor(now / 3600000);

		// Get or initialize counters
		let counters = this.eventCounts.get(key);
		if (!counters) {
			counters = {
				minute: 0,
				hour: 0,
				lastResetMinute: currentMinute,
				lastResetHour: currentHour,
			};
			this.eventCounts.set(key, counters);
		}

		// Reset minute counter if needed
		if (counters.lastResetMinute !== currentMinute) {
			counters.minute = 0;
			counters.lastResetMinute = currentMinute;
		}

		// Reset hour counter if needed
		if (counters.lastResetHour !== currentHour) {
			counters.hour = 0;
			counters.lastResetHour = currentHour;
		}

		// Check limits
		if (config.maxPerMinute && counters.minute >= config.maxPerMinute) {
			console.log(
				`Rate limit exceeded for ${eventType}[${identifier}]: ${counters.minute}/${config.maxPerMinute} per minute`,
			);
			return false;
		}

		if (config.maxPerHour && counters.hour >= config.maxPerHour) {
			console.log(
				`Rate limit exceeded for ${eventType}[${identifier}]: ${counters.hour}/${config.maxPerHour} per hour`,
			);
			return false;
		}

		// Increment counters
		counters.minute++;
		counters.hour++;

		return true;
	}

	async executeBatched<T>(
		eventType: TEventType,
		identifier: string,
		operation: () => Promise<T>,
	): Promise<void> {
		const config = this.config[eventType];

		// If no batching configured or no config, execute immediately
		if (!config || !config.batchSize || !config.batchTimeoutMs) {
			await operation();
			return;
		}

		const key = `${this.namespace}:${eventType}:${identifier}`;

		// Get or create batch
		let batch = this.pendingBatches.get(key);
		if (!batch) {
			batch = { events: [] };
			this.pendingBatches.set(key, batch);
		}

		// Add operation to batch
		batch.events.push(async () => {
			await operation();
		});

		// Clear existing timeout
		if (batch.timeout) {
			clearTimeout(batch.timeout);
		}

		// Execute batch if size limit reached
		if (batch.events.length >= config.batchSize) {
			await this.executeBatch(key);
			return;
		}

		// Set timeout for batch execution
		batch.timeout = setTimeout(() => {
			this.executeBatch(key);
		}, config.batchTimeoutMs);
	}

	private async executeBatch(key: string): Promise<void> {
		const batch = this.pendingBatches.get(key);
		if (!batch || batch.events.length === 0) return;

		// Clear timeout
		if (batch.timeout) {
			clearTimeout(batch.timeout);
		}

		// Execute all operations in batch
		const operations = batch.events.splice(0); // Remove all events

		try {
			await Promise.allSettled(operations.map((op) => op()));
			console.log(
				`Executed batch of ${operations.length} operations for ${key}`,
			);
		} catch (error) {
			console.error(`Batch execution failed for ${key}:`, error);
		}

		// Clean up if batch is empty
		if (batch.events.length === 0) {
			this.pendingBatches.delete(key);
		}
	}

	// Main method to execute rate-limited operations
	async executeRateLimited<T>(
		eventType: TEventType,
		identifier: string,
		operation: () => Promise<T>,
	): Promise<{ success: boolean; rateLimited: boolean }> {
		// Check rate limit
		const allowed = await this.shouldAllowOperation(eventType, identifier);
		if (!allowed) {
			return { success: false, rateLimited: true };
		}

		// Execute with batching
		try {
			await this.executeBatched(eventType, identifier, operation);
			return { success: true, rateLimited: false };
		} catch (error) {
			console.error(
				`Failed to execute ${eventType} operation for ${identifier}:`,
				error,
			);
			return { success: false, rateLimited: false };
		}
	}

	// Cleanup method - execute all pending batches
	async cleanup(): Promise<void> {
		// Execute all pending batches
		const batchKeys = Array.from(this.pendingBatches.keys());
		await Promise.all(batchKeys.map((key) => this.executeBatch(key)));

		// Clear all data
		this.eventCounts.clear();
		this.pendingBatches.clear();
	}

	// Get statistics
	getStats(): Record<string, RateLimitStats> {
		const stats: Record<string, RateLimitStats> = {};

		for (const [key, counters] of this.eventCounts.entries()) {
			stats[key] = {
				minuteCount: counters.minute,
				hourCount: counters.hour,
			};
		}

		for (const [key, batch] of this.pendingBatches.entries()) {
			if (!stats[key]) {
				stats[key] = { minuteCount: 0, hourCount: 0 };
			}
			stats[key].pendingBatch = batch.events.length;
		}

		return stats;
	}

	// Update configuration at runtime
	updateConfig(eventType: TEventType, config: RateLimitConfig): void {
		this.config[eventType] = config;
	}

	// Get current configuration
	getConfig(): Record<TEventType, RateLimitConfig> {
		return { ...this.config };
	}
}

// Factory function for creating rate limiters with specific event types
export const createRateLimiter = <TEventType extends string>(
	config: Record<TEventType, RateLimitConfig>,
	namespace?: string,
): RateLimiter<TEventType> => {
	return new RateLimiter(config, namespace);
};

// Utility type for defining event configurations
export type EventConfig<T extends string> = Record<T, RateLimitConfig>;
