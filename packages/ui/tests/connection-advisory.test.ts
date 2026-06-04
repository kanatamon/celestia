import { describe, expect, it } from 'vitest';
import {
	isAdvisoryFaultKind,
	resolveConnectionAdvisoryContent,
	toConnectionSignalViewModel,
} from '../src/connection-advisory.js';

describe('toConnectionSignalViewModel', () => {
	it.each([
		['attaching', 'discovering'],
		['attached', 'discovering'],
		['connecting', 'discovering'],
		['detaching', 'discovering'],
		['disconnecting', 'discovering'],
		['connected', 'connected'],
		['detached', 'ended'],
		['disconnected', 'ended'],
	] as const)('projects %s onto the %s kind without a reason', (status, kind) => {
		const vm = toConnectionSignalViewModel({ status, username: 'celestia' });
		expect(vm.kind).toBe(kind);
		expect(vm.reason).toBeUndefined();
	});

	it('carries the offline reason through the offline kind', () => {
		const vm = toConnectionSignalViewModel({
			status: 'error',
			reason: 'offline',
			username: 'celestia',
		});
		expect(vm).toMatchObject({ kind: 'offline', label: 'Offline', reason: 'offline' });
	});

	it.each([
		'off-live',
		'interrupted',
		'stale',
	] as const)('carries the %s reason through the reconnecting kind', (reason) => {
		const vm = toConnectionSignalViewModel({ status: 'error', reason, username: 'celestia' });
		expect(vm).toMatchObject({ kind: 'reconnecting', label: 'Reconnecting', reason });
	});
});

describe('isAdvisoryFaultKind', () => {
	it('flags only offline and reconnecting as fault kinds', () => {
		expect(isAdvisoryFaultKind('offline')).toBe(true);
		expect(isAdvisoryFaultKind('reconnecting')).toBe(true);
		expect(isAdvisoryFaultKind('connected')).toBe(false);
		expect(isAdvisoryFaultKind('discovering')).toBe(false);
		expect(isAdvisoryFaultKind('ended')).toBe(false);
	});
});

describe('resolveConnectionAdvisoryContent', () => {
	it('explains an offline fault with no action and a red accent', () => {
		const content = resolveConnectionAdvisoryContent('offline');
		expect(content.title).toMatch(/offline/i);
		expect(content.why).toMatch(/network/i);
		expect(content.workaround).toMatch(/automatically|resume/i);
		expect(content.actionLabel).toBeUndefined();
		expect(content.secondary).toBeUndefined();
		expect(content.accent).toBe('red');
	});

	it('explains an interrupted fault with a Reconnect action and an amber accent', () => {
		const content = resolveConnectionAdvisoryContent('interrupted');
		expect(content.title).toMatch(/interrupt/i);
		expect(content.why).toMatch(/debugging this browser|DevTools/i);
		expect(content.actionLabel).toBe('Reconnect');
		expect(content.secondary).toBeUndefined();
		expect(content.accent).toBe('amber');
	});

	it('explains an off-live fault with a Reopen live action and an amber accent', () => {
		const content = resolveConnectionAdvisoryContent('off-live');
		expect(content.title).toMatch(/live/i);
		expect(content.why).toMatch(/navigat|left|away|live page/i);
		expect(content.actionLabel).toBe('Reopen live');
		expect(content.accent).toBe('amber');
	});

	it('gives off-live a Reopen live action distinct from the Reconnect reasons', () => {
		const offLive = resolveConnectionAdvisoryContent('off-live');
		expect(offLive.actionLabel).not.toBe('Reconnect');
		expect(resolveConnectionAdvisoryContent('interrupted').actionLabel).toBe('Reconnect');
		expect(resolveConnectionAdvisoryContent('stale').actionLabel).toBe('Reconnect');
	});

	it('explains a stale fault with a Reconnect action and a relaunch fallback', () => {
		const content = resolveConnectionAdvisoryContent('stale');
		expect(content.title).toMatch(/stall/i);
		expect(content.why).toMatch(/no new events|stalled|attached/i);
		expect(content.actionLabel).toBe('Reconnect');
		expect(content.secondary).toMatch(/relaunch|Launcher/i);
		expect(content.accent).toBe('amber');
	});

	it('produces a distinct title for each fault reason', () => {
		const titles = new Set(
			(['offline', 'off-live', 'interrupted', 'stale'] as const).map(
				(reason) => resolveConnectionAdvisoryContent(reason).title,
			),
		);
		expect(titles.size).toBe(4);
	});

	it('falls back to the interrupted copy for an unknown reason', () => {
		expect(resolveConnectionAdvisoryContent(undefined)).toEqual(
			resolveConnectionAdvisoryContent('interrupted'),
		);
	});
});
