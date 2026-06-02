import { describe, expect, it, vi } from 'vitest';
import {
	type FireworksDrawContext,
	FireworksEngine,
	type GlowSprite,
	type GlowSpriteSheet,
	MEGA_BLAST,
} from '../src/fireworks.js';

/** A deterministic sprite sheet that needs no DOM canvas. */
function stubSprites(): GlowSpriteSheet {
	const sprite = {} as unknown as GlowSprite;
	return {
		hueSteps: 36,
		spriteFor: () => sprite,
	};
}

/** A spy 2D context recording every canvas call the engine makes. */
function mockContext() {
	const calls: string[] = [];
	const ctx: FireworksDrawContext = {
		globalAlpha: 1,
		globalCompositeOperation: 'source-over',
		clearRect: vi.fn(() => {
			calls.push('clearRect');
		}),
		drawImage: vi.fn(() => {
			calls.push('drawImage');
		}),
	};
	return { ctx, calls };
}

function makeEngine(random?: () => number) {
	return new FireworksEngine({ sprites: stubSprites(), random: random ?? Math.random });
}

describe('FireworksEngine.emit', () => {
	it('spawns exactly the Mega blast count of particles', () => {
		const engine = makeEngine();
		engine.emit();
		expect(engine.particleCount).toBe(MEGA_BLAST.count);
	});

	it('spawns every particle at the burst origin', () => {
		const engine = makeEngine();
		engine.setOrigin({ x: 120, y: 40 });
		engine.emit();
		// Origin is private; observe it indirectly. With no step() yet, every
		// particle still sits at the origin, so its sprite is drawn centred there.
		const { ctx } = mockContext();
		engine.draw(ctx, 200, 200);
		// drawImage dx/dy place the sprite's top-left, so the first particle's
		// sprite is centred at (120, 40).
		const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
		const firstCall = drawImage.mock.calls[0];
		if (!firstCall) {
			throw new Error('Expected at least one drawImage call');
		}
		const [, dx, dy, dw, dh] = firstCall as [unknown, number, number, number, number];
		expect(dx).toBeCloseTo(120 - dw / 2);
		expect(dy).toBeCloseTo(40 - dh / 2);
	});
});

describe('FireworksEngine.step', () => {
	it('applies gravity to vertical velocity', () => {
		// Fixed RNG → angle 0, so vx = speed, vy = 0 before gravity.
		const engine = makeEngine(() => 0);
		engine.setOrigin({ x: 0, y: 0 });
		engine.emit();
		const dt = 0.02;
		const before = { ...capture(engine) };
		engine.step(dt);
		const after = { ...capture(engine) };
		// vy started at 0; gravity makes it positive (downward), then drag scales it.
		expect(after.vy).toBeGreaterThan(before.vy);
		expect(after.y).toBeGreaterThan(before.y);
	});

	it('decays velocity via drag', () => {
		// angle 0 → vx = speed[0] (since random()=0 → min of each range).
		const engine = makeEngine(() => 0);
		engine.emit();
		const beforeVx = capture(engine).vx;
		engine.step(0.02);
		const afterVx = capture(engine).vx;
		expect(Math.abs(afterVx)).toBeLessThan(Math.abs(beforeVx));
	});

	it('culls particles whose life has expired', () => {
		const engine = makeEngine();
		engine.emit();
		expect(engine.particleCount).toBe(MEGA_BLAST.count);
		// Max lifetime is 2.1s; stepping past it (clamped to 0.05s slices) culls all.
		for (let i = 0; i < 100; i++) {
			engine.step(0.05);
		}
		expect(engine.particleCount).toBe(0);
	});

	it('is a no-op with no particles', () => {
		const engine = makeEngine();
		expect(() => engine.step(0.016)).not.toThrow();
		expect(engine.particleCount).toBe(0);
	});
});

describe('FireworksEngine.draw idle-skip', () => {
	it('performs no canvas work when no particles have ever been alive', () => {
		const engine = makeEngine();
		const { ctx, calls } = mockContext();
		engine.draw(ctx, 100, 100);
		expect(calls).toEqual([]);
	});

	it('clears the canvas exactly once after the last particle dies, then idles', () => {
		const engine = makeEngine();
		engine.emit();
		const { ctx, calls } = mockContext();

		// A frame with live particles paints.
		engine.draw(ctx, 100, 100);
		expect(calls.filter((c) => c === 'drawImage').length).toBe(MEGA_BLAST.count);

		// Kill all particles.
		for (let i = 0; i < 100; i++) {
			engine.step(0.05);
		}
		expect(engine.particleCount).toBe(0);

		calls.length = 0;
		// First idle frame clears the dirty canvas once.
		engine.draw(ctx, 100, 100);
		expect(calls).toEqual(['clearRect']);

		calls.length = 0;
		// Subsequent idle frames touch nothing.
		engine.draw(ctx, 100, 100);
		engine.draw(ctx, 100, 100);
		expect(calls).toEqual([]);
	});
});

describe('FireworksEngine.draw rendering', () => {
	it('uses additive blend and a pre-rendered sprite per particle (no gradient/shadowBlur)', () => {
		const engine = makeEngine();
		engine.emit();
		const { ctx } = mockContext();
		const blendModes: string[] = [];
		// Record the blend mode in effect at each drawImage.
		(ctx.drawImage as ReturnType<typeof vi.fn>).mockImplementation(() => {
			blendModes.push(ctx.globalCompositeOperation as string);
		});

		engine.draw(ctx, 100, 100);

		expect(blendModes.length).toBe(MEGA_BLAST.count);
		expect(blendModes.every((m) => m === 'lighter')).toBe(true);
		// Restored afterwards so the host canvas is left in source-over.
		expect(ctx.globalCompositeOperation).toBe('source-over');
		// The mock context has no createRadialGradient / shadowBlur surface at all.
		expect('createRadialGradient' in ctx).toBe(false);
	});
});

/** Reads the first particle's public physics by replaying a draw. */
function capture(engine: FireworksEngine): { x: number; y: number; vx: number; vy: number } {
	// FireworksEngine exposes particle physics only through draw positions, so we
	// reach in via a typed cast to the private field for assertion purposes.
	const particles = (engine as unknown as { particles: PhysicsParticle[] }).particles;
	const p = particles[0];
	if (!p) {
		throw new Error('Expected at least one particle');
	}
	return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
}

interface PhysicsParticle {
	x: number;
	y: number;
	vx: number;
	vy: number;
}
