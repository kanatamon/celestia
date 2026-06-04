/**
 * Like Layer — Heart Float canvas overlay (PRD #79, issue #80).
 *
 * A `pointer-events:none` canvas stretched over the Session Tab feed. On each
 * like it spawns `heartsForBatch(n)` glossy pink hearts at the **Activity Bar
 * right edge**; they balloon upward with a calm sway, then peel off toward the
 * real **Like Counter** element and fade, nudging the counter on arrival via
 * `onHeartArrived`. The heart encodes no sender — a fixed heart-coloured glow
 * only (ADR-0008); "who liked" lives in the Heartbeat Conveyor, not here.
 *
 * Design invariants (issue #80 acceptance criteria):
 *  - **Read-only / no store mutation.** The component only consumes a spawn
 *    signal handed to the parent via `onReady`; it never touches the live-event
 *    store and persists nothing.
 *  - **No `getBoundingClientRect` in the hot path.** Anchor coordinates are
 *    resolved once and re-cached only on a `ResizeObserver` change (feed +
 *    both anchors). The rAF loop reads the cache, never the DOM.
 *  - **Idle-skip.** With no hearts in flight the loop parks (cancels the rAF)
 *    and does no canvas work; the next spawn restarts it.
 *  - **Pre-rendered sprite.** The heart + glow is rasterised once into an
 *    offscreen canvas and blitted per heart — no per-frame `shadowBlur` or
 *    gradient (the real CPU cost, ADR-0007 §3).
 *  - **StrictMode-safe.** All mutable state is ref-held; a single rAF is owned
 *    by one effect with `cancelAnimationFrame` cleanup; effects are idempotent.
 *  - **Reduced Like Motion / hidden tab.** Spawns are dropped (not buffered)
 *    while `reducedMotion` is on or the tab is hidden; the count still races
 *    via the store, decoupled from this layer.
 */

import { type RefObject, useCallback, useEffect, useRef } from 'react';
import styles from './like-layer.module.css';
import {
	admitHearts,
	createHeart,
	DIVERT_DUR,
	type Heart,
	RISE_DUR,
	RISE_SPEED,
	SWAY_AMP,
	SWAY_FREQ,
	spawnHeartCount,
	stepHeart,
} from './like-layer-motion.js';

/** Cap device-pixel-ratio so a 3x display does not triple the fill cost. */
const MAX_DPR = 2;
/** Cap a single frame's dt so a backgrounded tab cannot teleport hearts. */
const MAX_STEP_SECONDS = 0.05;
/** Heart base radius in CSS px before the rise balloon scale. */
const HEART_BASE_RADIUS = 9;
/** Glossy pink heart fill + glow (fixed; no per-sender hue). */
const HEART_COLOR = '#ff5fa2';
const HEART_GLOW_COLOR = 'rgba(255, 120, 175, 0.85)';

/** A spawn signal: how many likes arrived at once. */
export type SpawnLike = (likeDelta: number) => void;

export interface LikeLayerProps {
	/** The feed container the canvas overlays; the geometry origin. */
	feedRef: RefObject<HTMLElement | null>;
	/** Activity Bar right edge — hearts spawn here. */
	spawnAnchorRef: RefObject<HTMLElement | null>;
	/** The Like Counter element — hearts fly here and fade. */
	targetAnchorRef: RefObject<HTMLElement | null>;
	/**
	 * Handed the imperative spawn sink once mounted. The parent feeds it the
	 * per-event like delta straight from the Provider callback (read-only),
	 * mirroring the synthesized-celebration arbiter wiring.
	 */
	onReady?: (spawn: SpawnLike) => void;
	/** Fired once per heart when it reaches the Like Counter (drives the pop). */
	onHeartArrived?: () => void;
	/** Reduced Like Motion: drop hearts entirely (count still races elsewhere). */
	reducedMotion?: boolean;
	/**
	 * Bumped when "Clear Live Session data" is confirmed; clears in-flight hearts.
	 * A reset key (not watching `likeCount` hit 0) so it can't be confused with a
	 * genuine 0.
	 */
	resetKey?: number;
}

interface Anchors {
	/** Spawn point in canvas-local CSS px (Activity Bar right edge, vertically centred). */
	spawnX: number;
	spawnY: number;
	/** Target point in canvas-local CSS px (Like Counter centre). */
	targetX: number;
	targetY: number;
	/** Canvas CSS size, for sizing the backing store at the capped DPR. */
	width: number;
	height: number;
}

export function LikeLayer({
	feedRef,
	spawnAnchorRef,
	targetAnchorRef,
	onReady,
	onHeartArrived,
	reducedMotion = false,
	resetKey = 0,
}: LikeLayerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// All mutable animation state is ref-held so StrictMode's double-mount and
	// React re-renders never fork it or spawn a second loop.
	const heartsRef = useRef<Heart[]>([]);
	const anchorsRef = useRef<Anchors | null>(null);
	const spriteRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameRef = useRef<number>(0);
	const seqRef = useRef(0);
	const hiddenRef = useRef(false);

	// Latest callbacks/flags via refs so the rAF closure never goes stale and the
	// loop effect does not re-run (and re-fork) when they change.
	const onHeartArrivedRef = useRef(onHeartArrived);
	onHeartArrivedRef.current = onHeartArrived;
	const reducedMotionRef = useRef(reducedMotion);
	reducedMotionRef.current = reducedMotion;

	const recacheAnchors = useCallback(() => {
		const canvas = canvasRef.current;
		const feed = feedRef.current;
		const spawn = spawnAnchorRef.current;
		const target = targetAnchorRef.current;
		if (!canvas || !feed) return;

		const feedRect = feed.getBoundingClientRect();
		const width = feedRect.width;
		const height = feedRect.height;

		// Size the canvas backing store to the capped DPR; CSS size matches the feed.
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		const backingW = Math.max(1, Math.round(width * dpr));
		const backingH = Math.max(1, Math.round(height * dpr));
		if (canvas.width !== backingW) canvas.width = backingW;
		if (canvas.height !== backingH) canvas.height = backingH;
		const ctx = canvas.getContext('2d');
		if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const spawnRect = spawn?.getBoundingClientRect();
		const targetRect = target?.getBoundingClientRect();

		anchorsRef.current = {
			spawnX: spawnRect ? spawnRect.right - feedRect.left : width - 12,
			spawnY: spawnRect ? spawnRect.top + spawnRect.height / 2 - feedRect.top : height - 24,
			targetX: targetRect ? targetRect.left + targetRect.width / 2 - feedRect.left : 24,
			targetY: targetRect ? targetRect.top + targetRect.height / 2 - feedRect.top : 24,
			width,
			height,
		};
	}, [feedRef, spawnAnchorRef, targetAnchorRef]);

	// Pre-render the heart + glow sprite once. Rebuilt only if missing.
	const ensureSprite = useCallback(() => {
		if (spriteRef.current) return spriteRef.current;
		spriteRef.current = createHeartSprite();
		return spriteRef.current;
	}, []);

	const drawFrame = useCallback(() => {
		const canvas = canvasRef.current;
		const anchors = anchorsRef.current;
		if (!canvas || !anchors) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const sprite = ensureSprite();

		ctx.clearRect(0, 0, anchors.width, anchors.height);
		ctx.globalCompositeOperation = 'lighter';

		for (const heart of heartsRef.current) {
			const placed = placeHeart(heart, anchors);
			if (!placed) continue;
			const size = HEART_BASE_RADIUS * 2 * placed.scale * SPRITE_SCALE;
			ctx.globalAlpha = placed.alpha;
			ctx.drawImage(sprite, placed.x - size / 2, placed.y - size / 2, size, size);
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	}, [ensureSprite]);

	// The single rAF loop. Owned by exactly one effect; idempotent start/stop so
	// StrictMode's mount→unmount→mount cycle never leaves two loops running.
	const tick = useCallback(
		(now: number) => {
			const dtRaw = (now - lastFrameRef.current) / 1000;
			lastFrameRef.current = now;
			const dt = Math.min(Math.max(dtRaw, 0), MAX_STEP_SECONDS);

			const next: Heart[] = [];
			for (const heart of heartsRef.current) {
				const { heart: stepped, arrivedNow } = stepHeart(heart, dt);
				if (arrivedNow) onHeartArrivedRef.current?.();
				if (stepped.phase !== 'dead') next.push(stepped);
			}
			heartsRef.current = next;

			drawFrame();

			if (next.length === 0) {
				// Idle-skip: nothing in flight, park the loop. A spawn restarts it.
				rafRef.current = null;
				return;
			}
			rafRef.current = requestAnimationFrame(tick);
		},
		[drawFrame],
	);

	const startLoop = useCallback(() => {
		if (rafRef.current !== null) return;
		lastFrameRef.current = performance.now();
		rafRef.current = requestAnimationFrame(tick);
	}, [tick]);

	const spawn = useCallback<SpawnLike>(
		(likeDelta) => {
			// Drop, never buffer, while Reduced Like Motion is on or the tab is
			// hidden. The pure `spawnHeartCount` owns that decision (unit-tested); a
			// zero count means no Heart Float, while the count still races via the store.
			const count = spawnHeartCount(likeDelta, {
				reducedMotion: reducedMotionRef.current,
				hidden: hiddenRef.current,
			});
			if (count === 0) return;
			recacheAnchors();
			const fresh: Heart[] = [];
			for (let i = 0; i < count; i += 1) {
				seqRef.current += 1;
				fresh.push(createHeart(`heart-${seqRef.current}`));
			}
			heartsRef.current = admitHearts(heartsRef.current, fresh);
			startLoop();
		},
		[recacheAnchors, startLoop],
	);

	// Hand the spawn sink to the parent. `spawn` is stable, so this fires once.
	useEffect(() => {
		onReady?.(spawn);
	}, [onReady, spawn]);

	// Geometry: cache anchor coordinates and re-cache on any layout change to the
	// feed or either anchor (covers window resize and SplitFeedLayout splitter
	// drag by construction). The loop only ever reads the cache.
	useEffect(() => {
		recacheAnchors();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', recacheAnchors);
			return () => window.removeEventListener('resize', recacheAnchors);
		}
		const observer = new ResizeObserver(recacheAnchors);
		for (const el of [feedRef.current, spawnAnchorRef.current, targetAnchorRef.current]) {
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, [recacheAnchors, feedRef, spawnAnchorRef, targetAnchorRef]);

	// Pause spawning while the tab is hidden; drop-not-buffer. The count keeps
	// updating via the store; on visible we resume from current state.
	useEffect(() => {
		const onVisibility = () => {
			hiddenRef.current = document.visibilityState === 'hidden';
		};
		onVisibility();
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, []);

	// Single owned rAF lifecycle: cancel on unmount so StrictMode cannot stack loops.
	useEffect(() => {
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, []);

	// Session clear: drop in-flight hearts and repaint empty. Bumping the key is
	// an explicit reset, never inferred from likeCount.
	// biome-ignore lint/correctness/useExhaustiveDependencies: clear only when the reset key changes.
	useEffect(() => {
		if (resetKey === 0) return;
		heartsRef.current = [];
		drawFrame();
	}, [resetKey]);

	// Reduced Like Motion turned on mid-flight: clear what is already flying.
	useEffect(() => {
		if (!reducedMotion) return;
		heartsRef.current = [];
		drawFrame();
	}, [reducedMotion, drawFrame]);

	return (
		<div aria-hidden="true" className={styles.likeLayer} data-celestia-like-layer>
			<canvas className={styles.likeLayerCanvas} ref={canvasRef} />
		</div>
	);
}

interface PlacedHeart {
	x: number;
	y: number;
	scale: number;
	alpha: number;
}

/** Map a heart's time-domain state onto canvas-local pixels using cached anchors. */
function placeHeart(heart: Heart, anchors: Anchors): PlacedHeart | null {
	if (heart.phase === 'dead') return null;

	if (heart.phase === 'rise') {
		const riseFrac = heart.riseT / RISE_DUR;
		const sway = Math.sin(heart.riseT * SWAY_FREQ * Math.PI * 2) * SWAY_AMP;
		return {
			x: anchors.spawnX + sway,
			y: anchors.spawnY - heart.riseT * RISE_SPEED,
			scale: 0.7 + 0.3 * riseFrac,
			alpha: 1,
		};
	}

	// divert / fade: ease from the rise-end point toward the Like Counter.
	const riseEndX = anchors.spawnX;
	const riseEndY = anchors.spawnY - RISE_DUR * RISE_SPEED;
	const t = Math.min(heart.divertT / DIVERT_DUR, 1);
	const ease = easeInOutCubic(t);
	return {
		x: lerp(riseEndX, anchors.targetX, ease),
		y: lerp(riseEndY, anchors.targetY, ease),
		scale: 1 - 0.4 * t,
		alpha: 1 - t,
	};
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Sprite is drawn larger than the heart so the soft glow has room. */
const SPRITE_SCALE = 2.4;

/**
 * Pre-render the glossy pink heart + soft glow once into an offscreen canvas.
 * Done a single time at startup so the hot path never pays for `shadowBlur` or
 * a radial gradient (ADR-0007 §3).
 */
function createHeartSprite(): HTMLCanvasElement {
	const size = HEART_BASE_RADIUS * 2 * SPRITE_SCALE * MAX_DPR;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return canvas;

	const cx = size / 2;
	const cy = size / 2;
	const r = HEART_BASE_RADIUS * MAX_DPR;

	// Soft glow halo.
	const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * SPRITE_SCALE);
	glow.addColorStop(0, HEART_GLOW_COLOR);
	glow.addColorStop(1, 'rgba(255, 120, 175, 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, size, size);

	// Glossy heart body.
	ctx.fillStyle = HEART_COLOR;
	tracePinkHeart(ctx, cx, cy, r);
	ctx.fill();

	// Highlight for gloss.
	ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
	ctx.beginPath();
	ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
	ctx.fill();

	return canvas;
}

function tracePinkHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
	ctx.beginPath();
	const top = cy - r * 0.35;
	ctx.moveTo(cx, cy + r * 0.85);
	ctx.bezierCurveTo(cx + r * 1.4, cy - r * 0.2, cx + r * 0.6, top - r * 0.9, cx, top);
	ctx.bezierCurveTo(cx - r * 0.6, top - r * 0.9, cx - r * 1.4, cy - r * 0.2, cx, cy + r * 0.85);
	ctx.closePath();
}
