/**
 * Heartbeat Conveyor — avatar-only DOM row of recent likers (PRD #79, issue #81).
 *
 * The identity half of the **Like Layer**: a row of `<img>` avatars (the face
 * only — no nickname text, CONTEXT.md) seated beside the Activity Bar. Where the
 * **Heart Float** is anonymous ambient motion and the **Like Counter** races,
 * the Conveyor is deliberately **calm**: it advances only on a slow ~1.2s
 * metronome, never per like, so it stays restful under a like storm
 * (`decoupling the visible update rate from the like rate`).
 *
 * Read-only by construction, mirroring the Heart Float sink (`like-layer.tsx`):
 * the parent feeds likes in through the `push` callback handed out via `onReady`
 * straight from the Provider's event stream. The Conveyor never touches the
 * live-event store and persists nothing.
 *
 * Design split (issue #81):
 *  - `heartbeat-conveyor-motion` owns membership + timing (pure reducer): which
 *    faces are seated, dedupe, capacity-5 eviction, repeat-liker breathe.
 *  - this component owns *space*: it drives the metronome, projects the reducer
 *    state to a keyed `<img>` row, and lets CSS do the slide / fade-in / breathe.
 *
 * Avatar rendering is native `<img>` only — cross-origin TikTok CDN faces render
 * with no canvas, no CORS taint, no bitmap cache (issue #81). A missing
 * `avatarUrl` or an `onError` falls back to an initial chip, so a broken URL is
 * never a broken image.
 *
 * Reduced Like Motion (CONTEXT.md): the membership is identical; only the CSS
 * transition swaps the sliding metronome for a cross-fade. Information (the
 * faces) is never removed, only decorative motion.
 *
 * StrictMode-safe: the metronome is a single owned `setInterval` with cleanup;
 * the reducer is pure so React's double-invoke cannot fork membership.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import styles from './heartbeat-conveyor.module.css';
import {
	BEAT_MS,
	type ConveyorLiker,
	type ConveyorState,
	type ConveyorTransition,
	computeConveyor,
	initialConveyorState,
} from './heartbeat-conveyor-motion.js';

/** The read-only sink the parent feeds one liker per `LikeLiveEvent`. */
export type PushLiker = (liker: ConveyorLiker) => void;

export interface HeartbeatConveyorProps {
	/**
	 * Handed the imperative push sink once mounted. The parent feeds it the
	 * liker straight from the Provider callback (read-only), mirroring the Heart
	 * Float spawn wiring.
	 */
	onReady?: (push: PushLiker) => void;
	/**
	 * Reduced Like Motion: swap the sliding metronome for a cross-fade. Faces and
	 * the beat cadence are unchanged — only the transition style differs.
	 */
	reducedMotion?: boolean;
	/**
	 * Bumped when "Clear Live Session data" is confirmed; empties the row. A reset
	 * key (not inferred from an empty like stream) so a genuine lull never clears.
	 */
	resetKey?: number;
}

type Action =
	| { kind: 'event'; liker: ConveyorLiker }
	| { kind: 'beat'; reducedMotion: boolean }
	| { kind: 'reset' };

function reducer(state: ConveyorState, action: Action): ConveyorState {
	switch (action.kind) {
		case 'event':
			return computeConveyor(state, { kind: 'like', liker: action.liker }, Date.now());
		case 'beat':
			return computeConveyor(
				state,
				{ kind: 'beat', reducedMotion: action.reducedMotion },
				Date.now(),
			);
		case 'reset':
			return initialConveyorState;
	}
}

export function HeartbeatConveyor({
	onReady,
	reducedMotion = false,
	resetKey = 0,
}: HeartbeatConveyorProps) {
	const [state, dispatch] = useReducer(reducer, initialConveyorState);

	// Read the live Reduced Like Motion flag in the beat tick without re-arming the
	// metronome interval when the preference changes mid-session.
	const reducedMotionRef = useRef(reducedMotion);
	reducedMotionRef.current = reducedMotion;

	// Stable push sink: dispatch is stable, so `onReady` fires once.
	const push = useCallback<PushLiker>((liker) => dispatch({ kind: 'event', liker }), []);
	useEffect(() => {
		onReady?.(push);
	}, [onReady, push]);

	// The single owned metronome. One interval, cleaned up on unmount, so
	// StrictMode's mount→unmount→mount never stacks two beats. Each beat carries
	// the live Reduced Like Motion flag so the seated face is stamped slide vs.
	// cross-fade — the sole source of truth (no OS `prefers-reduced-motion`).
	useEffect(() => {
		const id = setInterval(
			() => dispatch({ kind: 'beat', reducedMotion: reducedMotionRef.current }),
			BEAT_MS,
		);
		return () => clearInterval(id);
	}, []);

	// Explicit session reset: empty the row. Keyed, never inferred from a lull.
	useEffect(() => {
		if (resetKey === 0) return;
		dispatch({ kind: 'reset' });
	}, [resetKey]);

	return (
		<div aria-hidden="true" className={styles.conveyor} data-celestia-heartbeat-conveyor="">
			{state.slots.map((slot) => (
				<ConveyorAvatar
					key={slot.key}
					liker={slot.liker}
					breatheSeq={slot.breatheSeq}
					transition={slot.transition}
				/>
			))}
		</div>
	);
}

function ConveyorAvatar({
	liker,
	breatheSeq,
	transition,
}: {
	liker: ConveyorLiker;
	breatheSeq: number;
	transition: ConveyorTransition;
}) {
	// Fall back to an initial chip when the URL is missing or the image errors,
	// so a broken CDN face is never a broken <img>.
	const [broken, setBroken] = useState(false);
	const showImage = !!liker.avatarUrl && !broken;

	return (
		<span
			className={`${styles.seat} ${transition === 'crossfade' ? styles.reduced : ''}`}
			data-breathe={breatheToken(breatheSeq)}
			data-transition={transition}
		>
			{showImage ? (
				<img
					alt=""
					className={styles.avatar}
					src={liker.avatarUrl}
					onError={() => setBroken(true)}
					referrerPolicy="no-referrer"
					decoding="async"
					loading="eager"
				/>
			) : (
				<span className={styles.fallback} data-conveyor-fallback="">
					{initialOf(liker)}
				</span>
			)}
		</span>
	);
}

/**
 * Project the reducer's monotonic `breatheSeq` onto the alternating `a`/`b`
 * token the CSS toggles on. A freshly seated avatar (seq 0) emits `undefined` so
 * only the seat's enter animation runs; every later bump flips the token,
 * restarting the one-shot breathe keyframe — for any tally, never capped.
 */
function breatheToken(breatheSeq: number): 'a' | 'b' | undefined {
	if (breatheSeq <= 0) {
		return undefined;
	}
	return breatheSeq % 2 === 1 ? 'a' : 'b';
}

function initialOf(liker: ConveyorLiker): string {
	const source = liker.name?.trim() || liker.id;
	const first = [...source][0];
	return first ? first.toUpperCase() : '?';
}
