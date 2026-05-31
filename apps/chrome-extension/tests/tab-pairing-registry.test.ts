import { beforeEach, describe, expect, it } from 'vitest';
import { createTabPairingRegistry } from '../src/background/tab-pairing-registry.js';

describe('tab pairing registry', () => {
	let storageArea: FakeChromeSessionStorageArea;

	beforeEach(() => {
		storageArea = new FakeChromeSessionStorageArea();
	});

	it('writes a pair and reads back the paired session tab', async () => {
		const registry = createTabPairingRegistry(storageArea);

		await registry.setPair({ tiktokTabId: 1, sessionTabId: 2 });

		await expect(registry.getSessionTabId(1)).resolves.toBe(2);
		await expect(registry.findBySessionTabId(2)).resolves.toEqual({
			tiktokTabId: 1,
			sessionTabId: 2,
		});
	});

	it('reports unpaired tiktok tabs as null', async () => {
		const registry = createTabPairingRegistry(storageArea);

		await registry.setPair({ tiktokTabId: 1, sessionTabId: 2 });

		await expect(registry.getSessionTabId(99)).resolves.toBeNull();
		await expect(registry.findBySessionTabId(99)).resolves.toBeNull();
	});

	it('removes a pair by tiktok tab id', async () => {
		const registry = createTabPairingRegistry(storageArea);
		await registry.setPair({ tiktokTabId: 1, sessionTabId: 2 });
		await registry.setPair({ tiktokTabId: 3, sessionTabId: 4 });

		await registry.removeByTiktokTabId(1);

		await expect(registry.getSessionTabId(1)).resolves.toBeNull();
		await expect(registry.getSessionTabId(3)).resolves.toBe(4);
		await expect(registry.listPairs()).resolves.toEqual([{ tiktokTabId: 3, sessionTabId: 4 }]);
	});

	it('removes a pair by session tab id', async () => {
		const registry = createTabPairingRegistry(storageArea);
		await registry.setPair({ tiktokTabId: 1, sessionTabId: 2 });
		await registry.setPair({ tiktokTabId: 3, sessionTabId: 4 });

		await registry.removeBySessionTabId(2);

		await expect(registry.findBySessionTabId(2)).resolves.toBeNull();
		await expect(registry.getSessionTabId(1)).resolves.toBeNull();
		await expect(registry.listPairs()).resolves.toEqual([{ tiktokTabId: 3, sessionTabId: 4 }]);
	});

	it('overwrites the session tab when the same tiktok tab is paired again', async () => {
		const registry = createTabPairingRegistry(storageArea);

		await registry.setPair({ tiktokTabId: 1, sessionTabId: 2 });
		await registry.setPair({ tiktokTabId: 1, sessionTabId: 5 });

		await expect(registry.getSessionTabId(1)).resolves.toBe(5);
		await expect(registry.listPairs()).resolves.toEqual([{ tiktokTabId: 1, sessionTabId: 5 }]);
	});
});

class FakeChromeSessionStorageArea {
	readonly values = new Map<string, unknown>();

	async get(key: string): Promise<Record<string, unknown>> {
		return { [key]: this.values.get(key) };
	}

	async set(items: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(items)) {
			this.values.set(key, value);
		}
	}

	async remove(key: string): Promise<void> {
		this.values.delete(key);
	}
}
