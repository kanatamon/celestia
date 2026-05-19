/// <reference path="../types/chrome-api.d.ts" />

export type Debuggee = ChromeApi.Debuggee;
export type ChromeDebuggerEventHandler = (
	source: Debuggee,
	method: string,
	params?: Record<string, unknown>,
) => void;
export type ChromeDebuggerDetachHandler = (source: Debuggee, reason: string) => void;

export interface ChromeDebuggerTransport {
	queryActiveTab(): Promise<ChromeApi.Tab | undefined>;
	attach(debuggee: Debuggee): Promise<void>;
	detach(debuggee: Debuggee): Promise<void>;
	enableNetwork(debuggee: Debuggee): Promise<void>;
	addEventListener(handler: ChromeDebuggerEventHandler): void;
	removeEventListener(handler: ChromeDebuggerEventHandler): void;
	addDetachListener(handler: ChromeDebuggerDetachHandler): void;
	removeDetachListener(handler: ChromeDebuggerDetachHandler): void;
}

export class ChromeApiDebuggerTransport implements ChromeDebuggerTransport {
	async queryActiveTab(): Promise<ChromeApi.Tab | undefined> {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		return tab;
	}

	async attach(debuggee: Debuggee): Promise<void> {
		await chrome.debugger.attach(debuggee, '1.3');
	}

	async detach(debuggee: Debuggee): Promise<void> {
		await chrome.debugger.detach(debuggee);
	}

	async enableNetwork(debuggee: Debuggee): Promise<void> {
		await chrome.debugger.sendCommand(debuggee, 'Network.enable');
	}

	addEventListener(handler: ChromeDebuggerEventHandler): void {
		const addListener = chrome.debugger.onEvent.addListener as (
			listener: ChromeDebuggerEventHandler,
		) => void;
		addListener(handler);
	}

	removeEventListener(handler: ChromeDebuggerEventHandler): void {
		const removeListener = chrome.debugger.onEvent.removeListener as (
			listener: ChromeDebuggerEventHandler,
		) => void;
		removeListener(handler);
	}

	addDetachListener(handler: ChromeDebuggerDetachHandler): void {
		chrome.debugger.onDetach.addListener(handler);
	}

	removeDetachListener(handler: ChromeDebuggerDetachHandler): void {
		chrome.debugger.onDetach.removeListener(handler);
	}
}
