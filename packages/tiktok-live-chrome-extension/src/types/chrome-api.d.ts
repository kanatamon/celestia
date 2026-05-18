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
}

declare const chrome: {
	tabs: {
		query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<ChromeApi.Tab[]>;
		update(tabId: number, updateProperties: { url: string }): Promise<ChromeApi.Tab>;
		onActivated: {
			addListener(handler: ChromeApi.TabActivatedHandler): void;
			removeListener(handler: ChromeApi.TabActivatedHandler): void;
		};
		onUpdated: {
			addListener(handler: ChromeApi.TabUpdatedHandler): void;
			removeListener(handler: ChromeApi.TabUpdatedHandler): void;
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
