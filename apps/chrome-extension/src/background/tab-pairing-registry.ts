/// <reference types="chrome" />

const REGISTRY_KEY = 'celestia-tab-pairing-registry';

export interface TabPair {
	tiktokTabId: number;
	sessionTabId: number;
}

interface ChromeSessionStorageArea {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(key: string): Promise<void>;
}

/**
 * The Tab Pairing Registry: the `tiktokTabId → sessionTabId` map maintained by
 * the service worker in `chrome.storage.session`. Consulted by the Launcher to
 * determine whether a TikTok Live tab already has a Session Tab. Cleared
 * automatically when the browser closes, since Chrome tab IDs do not survive
 * restarts.
 */
export interface TabPairingRegistry {
	getSessionTabId(tiktokTabId: number): Promise<number | null>;
	findBySessionTabId(sessionTabId: number): Promise<TabPair | null>;
	setPair(pair: TabPair): Promise<void>;
	removeByTiktokTabId(tiktokTabId: number): Promise<void>;
	removeBySessionTabId(sessionTabId: number): Promise<void>;
	listPairs(): Promise<TabPair[]>;
}

type StoredRegistry = Record<string, number>;

export function createTabPairingRegistry(
	storageArea = getChromeSessionStorageArea(),
): TabPairingRegistry {
	async function read(): Promise<StoredRegistry> {
		const values = await storageArea.get(REGISTRY_KEY);
		return toStoredRegistry(values[REGISTRY_KEY]);
	}

	async function write(registry: StoredRegistry): Promise<void> {
		if (Object.keys(registry).length === 0) {
			await storageArea.remove(REGISTRY_KEY);
			return;
		}

		await storageArea.set({ [REGISTRY_KEY]: registry });
	}

	return {
		async getSessionTabId(tiktokTabId) {
			const registry = await read();
			return registry[String(tiktokTabId)] ?? null;
		},
		async findBySessionTabId(sessionTabId) {
			const registry = await read();

			for (const [tiktokTabId, pairedSessionTabId] of Object.entries(registry)) {
				if (pairedSessionTabId === sessionTabId) {
					return { tiktokTabId: Number(tiktokTabId), sessionTabId };
				}
			}

			return null;
		},
		async setPair({ tiktokTabId, sessionTabId }) {
			const registry = await read();
			registry[String(tiktokTabId)] = sessionTabId;
			await write(registry);
		},
		async removeByTiktokTabId(tiktokTabId) {
			const registry = await read();
			delete registry[String(tiktokTabId)];
			await write(registry);
		},
		async removeBySessionTabId(sessionTabId) {
			const registry = await read();

			for (const [tiktokTabId, pairedSessionTabId] of Object.entries(registry)) {
				if (pairedSessionTabId === sessionTabId) {
					delete registry[tiktokTabId];
				}
			}

			await write(registry);
		},
		async listPairs() {
			const registry = await read();
			return Object.entries(registry).map(([tiktokTabId, sessionTabId]) => ({
				tiktokTabId: Number(tiktokTabId),
				sessionTabId,
			}));
		},
	};
}

function toStoredRegistry(value: unknown): StoredRegistry {
	if (typeof value !== 'object' || value === null) {
		return {};
	}

	const registry: StoredRegistry = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === 'number') {
			registry[key] = entry;
		}
	}

	return registry;
}

function getChromeSessionStorageArea(): ChromeSessionStorageArea {
	const sessionStorageArea = typeof chrome === 'undefined' ? undefined : chrome.storage?.session;

	return sessionStorageArea ?? createMemorySessionStorageArea();
}

function createMemorySessionStorageArea(): ChromeSessionStorageArea {
	const values = new Map<string, unknown>();

	return {
		async get(key) {
			return { [key]: values.get(key) };
		},
		async set(items) {
			for (const [key, value] of Object.entries(items)) {
				values.set(key, value);
			}
		},
		async remove(key) {
			values.delete(key);
		},
	};
}
