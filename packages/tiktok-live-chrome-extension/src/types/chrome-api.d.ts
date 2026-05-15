declare namespace ChromeApi {
	interface Tab {
		id?: number;
		url?: string;
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
}

declare const chrome: {
	tabs: {
		query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<ChromeApi.Tab[]>;
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
};
