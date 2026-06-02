import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Plugin } from 'vite';

/**
 * Route A for issue #65 — inject the Gift Animation Tap as a synchronous,
 * classic (non-module) MAIN-world content script at `document_start`.
 *
 * crxjs wraps every `content_scripts[].js` entry in an async-`import()` loader
 * stub, so `installGiftAnimationTap()` runs ~1s late (measured `sinceNavMs` ~934,
 * `readyState: 'interactive'`) — after TikTok's own code, defeating ADR-0006's
 * "patch globals before TikTok runs" guarantee.
 *
 * This plugin bypasses crxjs for that one script: it bundles `tap-main.ts` into a
 * self-contained classic IIFE with Rolldown (the bundler Vite 8 already ships),
 * writes it to the build output, and patches the emitted `manifest.json` to
 * register it directly. Because the entry is NOT listed in `manifest.config.ts`,
 * crxjs never sees it and never adds the loader — Chrome injects the classic
 * script synchronously at `document_start`.
 *
 * NOTE (issue #65): this leans on crxjs emitting `manifest.json` before this
 * plugin's `writeBundle` runs. A crxjs major upgrade could move that seam; the
 * build asserts the final manifest references the classic file, not a `-loader`.
 */

const PLUGIN_NAME = 'celestia:gift-tap-classic-injection';
const TAP_OUTPUT_FILENAME = 'gift-animation-tap-main.js';
const TAP_MATCHES = ['https://*.tiktok.com/*'];

interface ManifestContentScript {
	js?: string[];
	world?: string;
	run_at?: string;
}

/**
 * Guard the one fragility of Route A: this plugin assumes crxjs has already
 * emitted `manifest.json` (so we can append to it) and that crxjs did NOT also
 * wrap our tap in its async loader. If a crxjs upgrade moves that seam, fail the
 * build loudly here instead of silently shipping the late-injection regression.
 */
function assertSynchronousMainInjection(
	manifest: { content_scripts?: ManifestContentScript[] },
	manifestPath: string,
): void {
	const mainScripts = (manifest.content_scripts ?? []).filter((s) => s.world === 'MAIN');
	const ours = mainScripts.filter((s) => s.js?.length === 1 && s.js[0] === TAP_OUTPUT_FILENAME);
	if (ours.length !== 1) {
		throw new Error(
			`[${PLUGIN_NAME}] expected exactly one MAIN-world content script for ${TAP_OUTPUT_FILENAME} in ${manifestPath}, found ${ours.length}.`,
		);
	}
	const wrapped = mainScripts.find((s) => s.js?.some((f) => f.includes('-loader')));
	if (wrapped) {
		throw new Error(
			`[${PLUGIN_NAME}] a MAIN-world tap is still going through a crxjs async loader (${wrapped.js?.join(', ')}). The synchronous document_start guarantee is broken (issue #65).`,
		);
	}
}

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const tapEntry = resolve(appRoot, 'src/gift-animation-tap/tap-main.ts');

// Mirror vite.config.ts aliases so the standalone bundle resolves workspace deps.
const workspaceAlias: Record<string, string> = {
	'@celestia/tiktok-live-chrome-extension': resolve(
		appRoot,
		'../../packages/tiktok-live-chrome-extension/src/index.ts',
	),
	'@celestia/tiktok-live-core': resolve(appRoot, '../../packages/tiktok-live-core/src/index.ts'),
};

async function bundleTapAsClassicIife(): Promise<string> {
	const bundle = await rolldown({
		input: tapEntry,
		platform: 'browser',
		resolve: { alias: workspaceAlias },
	});
	try {
		const { output } = await bundle.generate({ format: 'iife' });
		return output[0].code;
	} finally {
		await bundle.close();
	}
}

export function giftTapClassicInjection(): Plugin {
	let outDir = 'dist';
	return {
		name: PLUGIN_NAME,
		apply: 'build',
		configResolved(config) {
			outDir = resolve(config.root, config.build.outDir);
		},
		// Runs after crxjs has written manifest.json + the rest of the bundle.
		async writeBundle() {
			const code = await bundleTapAsClassicIife();
			// The whole point of Route A: the tap must be synchronous. A surviving
			// dynamic `import()` would reintroduce the ~1s async-loader delay (#65).
			if (code.includes('import(')) {
				throw new Error(
					`[${PLUGIN_NAME}] bundled tap still contains a dynamic import() — it would install asynchronously, defeating the document_start guarantee (issue #65).`,
				);
			}
			await writeFile(resolve(outDir, TAP_OUTPUT_FILENAME), code, 'utf8');

			const manifestPath = resolve(outDir, 'manifest.json');
			const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
			manifest.content_scripts = manifest.content_scripts ?? [];
			// Front of the array so the tap registers before the isolated relay.
			manifest.content_scripts.unshift({
				matches: TAP_MATCHES,
				js: [TAP_OUTPUT_FILENAME],
				run_at: 'document_start',
				world: 'MAIN',
			});
			await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

			assertSynchronousMainInjection(manifest, manifestPath);
		},
	};
}
