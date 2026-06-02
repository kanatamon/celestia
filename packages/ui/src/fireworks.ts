/**
 * Fireworks particle engine (PRD #66 §B, ADR-0007) — a cheap canvas deep module
 * driving the **Synthesized Gift Celebration** rainbow burst.
 *
 * Three pure-ish surfaces:
 *   - `emit()`   spawns one Mega burst of particles from the burst origin.
 *   - `step(dt)` integrates physics (gravity + drag) and culls expired particles.
 *   - `draw(ctx)` paints live particles with additive blend; **no per-frame
 *     `shadowBlur` and no per-particle gradient** — the glow comes from a small
 *     set of pre-rendered hue sprites built once. With zero live particles the
 *     draw loop performs **no** canvas work beyond a single clear of a dirty
 *     canvas (idle-skip).
 *
 * Locked params come from the converged prototype
 * (`apps/chrome-extension/src/session-tab/gift-fallback-animation-prototype.html`,
 * "mega" blast + "Above" height).
 */

/** ~2.8s celebration beat. */
export const FIREWORKS_BEAT_MS = 2800;
/** Burst fires ~24% into the loop, when the Gift Icon lands (matches the pop). */
export const FIREWORKS_BURST_OFFSET_MS = 690;
/** Burst origin = centre-pane top + this fraction of the pane height ("Above"). */
export const FIREWORKS_BURST_HEIGHT_FRACTION = 0.32;

/** The locked "Mega" blast preset from the prototype. */
export const MEGA_BLAST: BlastPreset = {
	count: 132,
	gravity: 300,
	drag: 0.54,
	glowScale: 8,
	size: [2, 6],
	lifetime: [1.0, 2.1],
	speed: [200, 690],
};

export interface BlastPreset {
	count: number;
	/** px/s² downward acceleration. */
	gravity: number;
	/** Per-second velocity retention base; applied as `drag^dt`. */
	drag: number;
	/** Drawn sprite diameter = `size * glowScale`. */
	glowScale: number;
	size: [number, number];
	/** Seconds. */
	lifetime: [number, number];
	/** px/s. */
	speed: [number, number];
}

export interface FireworksParticle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Remaining seconds; culled at `<= 0`. */
	life: number;
	maxLife: number;
	size: number;
	hue: number;
}

export interface BurstOrigin {
	x: number;
	y: number;
}

/** A pre-rendered glow sprite addressable by `drawImage`. */
export type GlowSprite = CanvasImageSource;

export interface GlowSpriteSheet {
	hueSteps: number;
	/** Returns the nearest pre-rendered sprite for a hue in [0, 360). */
	spriteFor(hue: number): GlowSprite;
}

export interface FireworksEngineOptions {
	preset?: BlastPreset;
	/** Pre-rendered glow sprites. Defaults to a DOM-canvas sheet. */
	sprites?: GlowSpriteSheet;
	/** Injectable RNG in [0, 1) for deterministic tests. Defaults to `Math.random`. */
	random?: () => number;
}

const HUE_STEPS = 36;
const SPRITE_SIZE = 48;
const TWO_PI = Math.PI * 2;
/** Cap dt so a stalled tab cannot teleport particles across the canvas. */
const MAX_STEP_SECONDS = 0.05;

export class FireworksEngine {
	private readonly preset: BlastPreset;
	private readonly sprites: GlowSpriteSheet;
	private readonly random: () => number;
	private particles: FireworksParticle[] = [];
	private origin: BurstOrigin = { x: 0, y: 0 };
	/** True once the canvas has visible ink that an idle frame must clear once. */
	private canvasDirty = false;

	constructor(options: FireworksEngineOptions = {}) {
		this.preset = options.preset ?? MEGA_BLAST;
		this.sprites = options.sprites ?? createGlowSpriteSheet();
		this.random = options.random ?? Math.random;
	}

	/** Moves the burst origin (centre-pane top + 0.32 * pane height, "Above"). */
	setOrigin(origin: BurstOrigin): void {
		this.origin = { x: origin.x, y: origin.y };
	}

	get particleCount(): number {
		return this.particles.length;
	}

	/** Spawns one Mega burst from the current origin. */
	emit(): void {
		const p = this.preset;
		for (let i = 0; i < p.count; i++) {
			const angle = this.range(0, TWO_PI);
			const speed = this.range(p.speed[0], p.speed[1]);
			const life = this.range(p.lifetime[0], p.lifetime[1]);
			this.particles.push({
				x: this.origin.x,
				y: this.origin.y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life,
				maxLife: life,
				size: this.range(p.size[0], p.size[1]),
				hue: this.range(0, 360),
			});
		}
	}

	/**
	 * Integrates one frame: `vy += g*dt; v *= drag^dt; pos += v*dt; life -= dt`,
	 * then culls particles whose life has run out. `dt` is in seconds and clamped.
	 */
	step(dt: number): void {
		if (this.particles.length === 0) {
			return;
		}
		const clamped = Math.min(MAX_STEP_SECONDS, Math.max(0, dt));
		const p = this.preset;
		const dragFactor = clamped > 0 ? p.drag ** clamped : 1;
		let anyExpired = false;
		for (const q of this.particles) {
			q.vy += p.gravity * clamped;
			q.vx *= dragFactor;
			q.vy *= dragFactor;
			q.x += q.vx * clamped;
			q.y += q.vy * clamped;
			q.life -= clamped;
			if (q.life <= 0) {
				anyExpired = true;
			}
		}
		if (anyExpired) {
			this.particles = this.particles.filter((q) => q.life > 0);
		}
	}

	/**
	 * Paints the live particles additively. When there are no live particles it
	 * does at most one `clearRect` to wipe a previously-painted canvas, then never
	 * touches the canvas again until particles return (idle-skip).
	 */
	draw(ctx: FireworksDrawContext, width: number, height: number): void {
		if (this.particles.length === 0) {
			if (this.canvasDirty) {
				ctx.clearRect(0, 0, width, height);
				this.canvasDirty = false;
			}
			return;
		}

		const p = this.preset;
		ctx.clearRect(0, 0, width, height);
		ctx.globalCompositeOperation = 'lighter';
		for (const q of this.particles) {
			const fade = (q.life / q.maxLife) ** 0.55;
			const diameter = q.size * p.glowScale;
			ctx.globalAlpha = Math.min(fade, 1);
			ctx.drawImage(
				this.sprites.spriteFor(q.hue),
				q.x - diameter / 2,
				q.y - diameter / 2,
				diameter,
				diameter,
			);
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		this.canvasDirty = true;
	}

	/** Drops all particles (e.g. when restarting the beat). Leaves canvas dirty. */
	reset(): void {
		this.particles = [];
	}

	private range(min: number, max: number): number {
		return min + this.random() * (max - min);
	}
}

/** The minimal 2D-context surface the engine paints through. */
export interface FireworksDrawContext {
	clearRect(x: number, y: number, w: number, h: number): void;
	drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
	globalAlpha: number;
	globalCompositeOperation: GlobalCompositeOperation | string;
}

/**
 * Builds the rainbow glow sprite sheet **once**: `HUE_STEPS` small radial-gradient
 * canvases, so the per-frame draw is a plain `drawImage` with no gradient or
 * `shadowBlur`. Falls back gracefully if 2D context creation fails.
 */
export function createGlowSpriteSheet(): GlowSpriteSheet {
	const fallback = document.createElement('canvas');
	fallback.width = SPRITE_SIZE;
	fallback.height = SPRITE_SIZE;
	const sprites: GlowSprite[] = [];
	for (let i = 0; i < HUE_STEPS; i++) {
		const hue = (i * 360) / HUE_STEPS;
		const canvas = document.createElement('canvas');
		canvas.width = SPRITE_SIZE;
		canvas.height = SPRITE_SIZE;
		const g = canvas.getContext('2d');
		if (g) {
			const grd = g.createRadialGradient(
				SPRITE_SIZE / 2,
				SPRITE_SIZE / 2,
				0,
				SPRITE_SIZE / 2,
				SPRITE_SIZE / 2,
				SPRITE_SIZE / 2,
			);
			grd.addColorStop(0.0, 'rgba(255,255,255,1)');
			grd.addColorStop(0.18, `hsla(${hue},100%,76%,0.95)`);
			grd.addColorStop(0.45, `hsla(${hue},100%,55%,0.45)`);
			grd.addColorStop(1.0, `hsla(${hue},100%,50%,0)`);
			g.fillStyle = grd;
			g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
		}
		sprites.push(canvas);
	}
	return {
		hueSteps: HUE_STEPS,
		spriteFor(hue: number): GlowSprite {
			// `% HUE_STEPS` wraps the top of the hue wheel (e.g. 359 rounds to step
			// 36) back to step 0, keeping the index in [0, HUE_STEPS).
			const index = Math.round(hue / (360 / HUE_STEPS)) % HUE_STEPS;
			// HUE_STEPS sprites are always built, so the fallback only satisfies the
			// optional-index type under noUncheckedIndexedAccess.
			return sprites[index] ?? fallback;
		},
	};
}
