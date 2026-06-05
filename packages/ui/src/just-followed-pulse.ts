import type { UserInfo } from '@celestia/tiktok-live-core';
import { useSyncExternalStore } from 'react';

/**
 * The "just followed" one-shot for the Follower Badge (issue #91).
 *
 * The follow *transition* arrives as a `SocialLiveEvent` with `action: 'follow'`
 * (decoded from `WebcastSocialMessage.common.displayText.key`). It is not a feed
 * card, so we can't drive the animation off the card lifecycle. This is a small
 * transient registry the app marks on each follow.
 *
 * Two pieces of derived standing per viewer:
 *
 *  - **followed** (sticky for the session): a decoded follow is authoritative
 *    standing - the viewer now follows - so we elevate them even on cards whose
 *    own `followStatus` was captured stale (0/undefined) *before* the follow.
 *    Without this the badge would only appear on the viewer's *next* message;
 *    with it the badge appears instantly on every avatar already in the feed.
 *    (Consistent with ADR-0010: the badge reads standing, not "were they
 *    following when this message was sent".)
 *  - **pulsing** (transient ~1.5s window): drives the pop + glow one-shot so the
 *    user notices the moment it happens, on every avatar of that viewer.
 *
 * Module-level singleton because each Session Tab is its own page/JS realm -
 * one feed per realm — and this is ephemeral session state (never persisted).
 */

// Total length of the `.justFollowed` animation: jf-pop (0.5s) plus jf-glow
// (0.28s delay + 1.15s) is about 1.43s. The pulse stays armed a hair longer so an
// avatar rendered at the tail of the window still plays the full one-shot.
const FOLLOW_PULSE_MS = 1500;

const followedKeys = new Set<string>();
const pulseExpiryByKey = new Map<string, number>();
const listeners = new Set<() => void>();

function notify(): void {
	for (const listener of listeners) listener();
}

/**
 * Resolve the identity key used to match a follow transition to a rendered
 * avatar. Mirrors the store's gift-attribution key so the avatar that renders a
 * later chat/gift card lines up with the follow event's actor.
 */
export function toFollowPulseKey(user: UserInfo | undefined): string | undefined {
	return user?.userId ?? user?.uniqueId ?? user?.secUid;
}

/** Mark a viewer as freshly-followed: elevate their standing and arm the pulse. */
export function markJustFollowed(user: UserInfo | undefined): void {
	const key = toFollowPulseKey(user);
	if (!key) return;
	followedKeys.add(key);
	pulseExpiryByKey.set(key, Date.now() + FOLLOW_PULSE_MS);
	notify();
	setTimeout(() => {
		// Retire only the transient pulse; the sticky `followed` standing remains.
		const expiry = pulseExpiryByKey.get(key);
		if (expiry !== undefined && expiry <= Date.now()) {
			pulseExpiryByKey.delete(key);
			notify();
		}
	}, FOLLOW_PULSE_MS + 50);
}

function isFollowed(key: string | undefined): boolean {
	return key !== undefined && followedKeys.has(key);
}

function isPulsing(key: string | undefined): boolean {
	if (key === undefined) return false;
	const expiry = pulseExpiryByKey.get(key);
	return expiry !== undefined && expiry > Date.now();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export interface FollowerPulseState {
	/** Session-elevated standing from a decoded follow (sticky). */
	followed: boolean;
	/** Inside the transient pop + glow window (one-shot). */
	justFollowed: boolean;
}

/**
 * Subscribes the calling avatar to the follow registry. Re-renders when a follow
 * is marked or its pulse retires, so every avatar of a freshly-followed viewer
 * lights up at once. Each `useSyncExternalStore` returns a stable primitive.
 */
export function useFollowerPulse(user: UserInfo | undefined): FollowerPulseState {
	const key = toFollowPulseKey(user);
	const followed = useSyncExternalStore(
		subscribe,
		() => isFollowed(key),
		() => false,
	);
	const justFollowed = useSyncExternalStore(
		subscribe,
		() => isPulsing(key),
		() => false,
	);
	return { followed, justFollowed };
}

/** Test-only: clear all registry state between cases. */
export function resetFollowerPulseRegistry(): void {
	followedKeys.clear();
	pulseExpiryByKey.clear();
	notify();
}
