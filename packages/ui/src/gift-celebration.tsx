import type { CSSProperties, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './gift-celebration.module.css';
import {
	computeGiftCelebrationTriptychLayout,
	type GiftCelebrationPaneLayout,
	getGiftCelebrationSourceAspectRatio,
} from './gift-celebration-layout.js';

export interface GiftCelebrationProps {
	assetUrl?: string;
	onEnded?: () => void;
}

interface GiftCelebrationStageProps {
	assetUrl: string;
	onEnded?: () => void;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 position;
varying vec2 uv;

void main() {
	uv = position * 0.5 + 0.5;
	gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D tex;
uniform vec2 sampleScale;
uniform vec2 sampleOffset;
varying vec2 uv;

void main() {
	vec2 fittedUv = uv * sampleScale + sampleOffset;

	if (fittedUv.x < 0.0 || fittedUv.x > 1.0 || fittedUv.y < 0.0 || fittedUv.y > 1.0) {
		gl_FragColor = vec4(0.0);
		return;
	}

	float hw = 0.5;
	vec3 rgb = texture2D(tex, vec2(fittedUv.x * hw, fittedUv.y)).rgb;
	float a = texture2D(tex, vec2(fittedUv.x * hw + hw, fittedUv.y)).r;
	gl_FragColor = vec4(rgb, a);
}
`;

const FULLSCREEN_QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export function GiftCelebration({ assetUrl, onEnded }: GiftCelebrationProps) {
	if (!assetUrl) {
		return null;
	}

	return <GiftCelebrationStage assetUrl={assetUrl} onEnded={onEnded} />;
}

function GiftCelebrationStage({ assetUrl, onEnded }: GiftCelebrationStageProps) {
	const stageRef = useRef<HTMLDivElement>(null);
	const viewport = useMeasuredViewport(stageRef);
	const layout = useMemo(
		() =>
			computeGiftCelebrationTriptychLayout({
				width: viewport.width,
				height: viewport.height,
			}),
		[viewport.width, viewport.height],
	);

	return (
		<div aria-label="Gift Celebration" className={styles.stage} ref={stageRef} role="img">
			<SplitAlphaVideoCanvas
				assetUrl={assetUrl}
				layout={layout.leftGutter}
				paneName="left gutter"
			/>
			<SplitAlphaVideoCanvas
				assetUrl={assetUrl}
				layout={layout.rightGutter}
				paneName="right gutter"
			/>
			<SplitAlphaVideoCanvas
				assetUrl={assetUrl}
				layout={layout.center}
				onEnded={onEnded}
				paneName="center"
			/>
		</div>
	);
}

interface SplitAlphaVideoCanvasProps {
	assetUrl: string;
	layout: GiftCelebrationPaneLayout;
	onEnded?: () => void;
	paneName: string;
}

function SplitAlphaVideoCanvas({
	assetUrl,
	layout,
	onEnded,
	paneName,
}: SplitAlphaVideoCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || layout.width <= 0 || layout.height <= 0) {
			return undefined;
		}

		canvas.width = Math.max(1, Math.round(layout.width * window.devicePixelRatio));
		canvas.height = Math.max(1, Math.round(layout.height * window.devicePixelRatio));

		const gl = canvas.getContext('webgl', {
			alpha: true,
			premultipliedAlpha: false,
		});
		if (!gl) {
			return undefined;
		}

		const renderer = createSplitAlphaRenderer(gl, canvas, layout.fit);
		if (!renderer) {
			return undefined;
		}

		const video = document.createElement('video');
		let animationFrame = 0;
		let disposed = false;

		video.src = assetUrl;
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';

		const draw = () => {
			if (disposed) {
				return;
			}
			renderer.draw(video);
			animationFrame = requestAnimationFrame(draw);
		};

		const handleEnded = () => {
			onEnded?.();
		};

		video.addEventListener('ended', handleEnded);
		video.addEventListener('play', draw, { once: true });
		void video.play().catch(() => {
			draw();
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(animationFrame);
			video.removeEventListener('ended', handleEnded);
			video.pause();
			video.removeAttribute('src');
			video.load();
			renderer.dispose();
		};
	}, [assetUrl, layout.fit, layout.height, layout.width, onEnded]);

	return (
		<canvas
			aria-label={`Gift Celebration ${paneName}`}
			className={styles.canvas}
			ref={canvasRef}
			style={toPaneStyle(layout)}
		/>
	);
}

function useMeasuredViewport(ref: RefObject<HTMLElement | null>) {
	const [viewport, setViewport] = useState({ width: 0, height: 0 });

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) {
			return undefined;
		}

		const measure = () => {
			const bounds = element.getBoundingClientRect();
			setViewport({ width: bounds.width, height: bounds.height });
		};

		measure();

		if (typeof ResizeObserver !== 'undefined') {
			const observer = new ResizeObserver(measure);
			observer.observe(element);
			return () => observer.disconnect();
		}

		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	}, [ref]);

	return viewport;
}

function toPaneStyle(layout: GiftCelebrationPaneLayout): CSSProperties {
	const transform = layout.mirrored ? 'scaleX(-1)' : undefined;

	return {
		left: `${layout.x}px`,
		top: `${layout.y}px`,
		width: `${layout.width}px`,
		height: `${layout.height}px`,
		zIndex: layout.zIndex,
		opacity: layout.opacity,
		filter: `blur(${layout.blurPx}px) brightness(${layout.brightness})`,
		transform,
	};
}

interface SplitAlphaRenderer {
	draw(video: HTMLVideoElement): void;
	dispose(): void;
}

function createSplitAlphaRenderer(
	gl: WebGLRenderingContext,
	canvas: HTMLCanvasElement,
	fit: GiftCelebrationPaneLayout['fit'],
): SplitAlphaRenderer | undefined {
	const program = createProgram(gl);
	if (!program) {
		return undefined;
	}

	const positionLocation = gl.getAttribLocation(program, 'position');
	const scaleLocation = gl.getUniformLocation(program, 'sampleScale');
	const offsetLocation = gl.getUniformLocation(program, 'sampleOffset');
	const textureLocation = gl.getUniformLocation(program, 'tex');
	const buffer = gl.createBuffer();
	const texture = gl.createTexture();

	if (
		positionLocation < 0 ||
		!buffer ||
		!texture ||
		!scaleLocation ||
		!offsetLocation ||
		!textureLocation
	) {
		if (buffer) {
			gl.deleteBuffer(buffer);
		}
		if (texture) {
			gl.deleteTexture(texture);
		}
		gl.deleteProgram(program);
		return undefined;
	}

	const activateWebGlProgram = gl.useProgram.bind(gl);
	activateWebGlProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTICES, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.uniform1i(textureLocation, 0);
	gl.enable(gl.BLEND);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);

	const sampleRect = computeSampleRect(canvas, fit);
	gl.uniform2f(scaleLocation, sampleRect.scaleX, sampleRect.scaleY);
	gl.uniform2f(offsetLocation, sampleRect.offsetX, sampleRect.offsetY);

	return {
		draw(video) {
			if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
				return;
			}

			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		},
		dispose() {
			gl.deleteTexture(texture);
			gl.deleteBuffer(buffer);
			gl.deleteProgram(program);
		},
	};
}

function computeSampleRect(
	canvas: HTMLCanvasElement,
	fit: GiftCelebrationPaneLayout['fit'],
): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
	const outputAspect = canvas.width / canvas.height;
	const sourceAspect = getGiftCelebrationSourceAspectRatio();

	if (fit === 'contain') {
		if (outputAspect > sourceAspect) {
			const scaleX = outputAspect / sourceAspect;
			return { scaleX, scaleY: 1, offsetX: (1 - scaleX) / 2, offsetY: 0 };
		}

		const scaleY = sourceAspect / outputAspect;
		return { scaleX: 1, scaleY, offsetX: 0, offsetY: (1 - scaleY) / 2 };
	}

	if (outputAspect > sourceAspect) {
		const scaleY = sourceAspect / outputAspect;
		return { scaleX: 1, scaleY, offsetX: 0, offsetY: (1 - scaleY) / 2 };
	}

	const scaleX = outputAspect / sourceAspect;
	return { scaleX, scaleY: 1, offsetX: (1 - scaleX) / 2, offsetY: 0 };
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
	if (!vertexShader || !fragmentShader) {
		if (vertexShader) {
			gl.deleteShader(vertexShader);
		}
		if (fragmentShader) {
			gl.deleteShader(fragmentShader);
		}
		return undefined;
	}

	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		return undefined;
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		gl.deleteProgram(program);
		return undefined;
	}

	return program;
}

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
): WebGLShader | undefined {
	const shader = gl.createShader(type);
	if (!shader) {
		return undefined;
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		gl.deleteShader(shader);
		return undefined;
	}

	return shader;
}
