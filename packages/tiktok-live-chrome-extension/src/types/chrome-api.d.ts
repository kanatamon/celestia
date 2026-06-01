declare namespace ChromeApi {
	interface Tab {
		active?: boolean;
		id?: number;
		url?: string;
	}

	interface TabChangeInfo {
		url?: string;
	}

	interface ActiveInfo {
		tabId: number;
		windowId: number;
	}

	interface Debuggee {
		tabId?: number;
	}

	type DebuggerEventHandler = (
		source: Debuggee,
		method: string,
		params?: Record<string, unknown>,
	) => void;
	type DebuggerDetachHandler = (source: Debuggee, reason: string) => void;
	type TabActivatedHandler = (activeInfo: ActiveInfo) => void;
	type TabUpdatedHandler = (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void;
	interface TabRemoveInfo {
		isWindowClosing: boolean;
		windowId: number;
	}
	type TabRemovedHandler = (tabId: number, removeInfo: TabRemoveInfo) => void;
	type MessageSender = { tab?: Tab; id?: string };
	type SendResponse = (response?: unknown) => void;
	type MessageHandler = (
		message: unknown,
		sender: MessageSender,
		sendResponse: SendResponse,
	) => boolean | undefined;
}

declare const chrome: {
	tabs: {
		query(
			queryInfo: { active: boolean; currentWindow: boolean } | { url: string },
		): Promise<ChromeApi.Tab[]>;
		create(createProperties: { url: string }): Promise<ChromeApi.Tab>;
		sendMessage(tabId: number, message: unknown): Promise<unknown>;
		update(
			tabId: number,
			updateProperties: { active: boolean } | { url: string },
		): Promise<ChromeApi.Tab>;
		remove(tabId: number): Promise<void>;
		onActivated: {
			addListener(handler: ChromeApi.TabActivatedHandler): void;
			removeListener(handler: ChromeApi.TabActivatedHandler): void;
		};
		onUpdated: {
			addListener(handler: ChromeApi.TabUpdatedHandler): void;
			removeListener(handler: ChromeApi.TabUpdatedHandler): void;
		};
		onRemoved: {
			addListener(handler: ChromeApi.TabRemovedHandler): void;
			removeListener(handler: ChromeApi.TabRemovedHandler): void;
		};
	};
	runtime: {
		getURL(path: string): string;
		sendMessage(message: unknown): Promise<unknown>;
		onMessage: {
			addListener(handler: ChromeApi.MessageHandler): void;
			removeListener(handler: ChromeApi.MessageHandler): void;
		};
	};
	debugger: {
		attach(target: ChromeApi.Debuggee, requiredVersion: string): Promise<void>;
		detach(target: ChromeApi.Debuggee): Promise<void>;
		sendCommand(target: ChromeApi.Debuggee, method: string): Promise<unknown>;
		onEvent: {
			addListener(handler: ChromeApi.DebuggerEventHandler): void;
			removeListener(handler: ChromeApi.DebuggerEventHandler): void;
		};
		onDetach: {
			addListener(handler: ChromeApi.DebuggerDetachHandler): void;
			removeListener(handler: ChromeApi.DebuggerDetachHandler): void;
		};
	};
	storage?: {
		session?: {
			get(key: string): Promise<Record<string, unknown>>;
			set(items: Record<string, unknown>): Promise<void>;
			remove(key: string): Promise<void>;
		};
	};
};
