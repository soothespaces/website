"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { StudyScene } from "./scenes";
import {
  COMPOSITE_FRAGMENT,
  INK_FRAGMENT,
  FIELD_FRAGMENT,
  VERTEX,
  WAVE_SPEED,
  WAVELENGTH,
  withDefines,
} from "./shaders";

// The frame shown with reduced motion.
const START_TIME = 40;
const MAX_DPR = 2;
// The baked amplitudes rotate once per wavelength, so they need enough
// texels per wavelength to interpolate without dimming between texels.
const FIELD_TEXELS_PER_METER = 16;
// Two sources per baked texture.
const SOURCE_SLOTS = 4;
const ANGULAR_SPEED = (Math.PI * 2 * WAVE_SPEED) / WAVELENGTH;

type Rgb = [number, number, number];

function readColor(probe: HTMLElement, variable: string): Rgb {
  probe.style.color = `var(${variable})`;
  const value = getComputedStyle(probe).color;
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  if (value.startsWith("color(")) return [numbers[0], numbers[1], numbers[2]];
  return [numbers[0] / 255, numbers[1] / 255, numbers[2] / 255];
}

function prefersMoreContrast() {
  const setting = document.documentElement.dataset.contrast;
  if (setting) return setting === "more";
  return matchMedia("(prefers-contrast: more)").matches;
}

// Each source wanders in phase and loudness on its own, like an uncorrelated
// voice, which slowly moves where its waves cancel out against the others'.
function spin(i: number, t: number): [number, number] {
  const seed = i * 2.39996;
  const phase =
    seed * 3 + 1.1 * Math.sin(0.21 * t + seed) + 0.7 * Math.sin(0.53 * t + 2.3 * seed);
  const gain = 0.8 + 0.2 * Math.sin(0.41 * t + 1.7 * seed);
  const angle = phase - ANGULAR_SPEED * t;
  return [gain * Math.cos(angle), gain * Math.sin(angle)];
}

function packScene(scene: StudyScene) {
  const walls = scene.strokes.filter((s) => s.kind === "wall");
  const furniture = scene.strokes.filter((s) => s.kind === "furniture");
  const fadedFurniture = scene.strokes.filter((s) => s.kind === "furniture-fade");
  const highlightedFurniture = scene.strokes.filter((s) => s.kind === "furniture-highlight");
  const strokes = [...walls, ...furniture, ...fadedFurniture, ...highlightedFurniture];
  const sources = scene.sound.slice(0, SOURCE_SLOTS);
  const boxes = sources.map((s) => [s.at[0], s.at[1], s.halfSize[0], s.halfSize[1]]);
  const rounding = sources.map((s) => s.rounding);
  while (boxes.length < SOURCE_SLOTS) {
    boxes.push([0, 0, 0, 0]);
    rounding.push(0);
  }
  return {
    defines: {
      SEG_COUNT: strokes.length,
      WALL_COUNT: walls.length,
      FADE_FURNITURE_START: walls.length + furniture.length,
      HIGHLIGHT_FURNITURE_START: walls.length + furniture.length + fadedFurniture.length,
      SOURCE_COUNT: sources.length,
      SOURCE_SLOTS,
    },
    segA: strokes.map((s) => [s.a[0], s.a[1], s.b[0], s.b[1]]),
    segB: strokes.map((s) => [s.radius, s.halfWidth]),
    sourceBox: boxes,
    sourceRounding: rounding,
  };
}

export function SceneCanvas({
  scene,
  stageRef,
  playing,
  reducedMotion,
  className = "",
}: {
  scene: StudyScene;
  stageRef: RefObject<HTMLElement | null>;
  playing: boolean;
  reducedMotion: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const controlRef = useRef({ playing, reducedMotion, update: () => {} });
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    controlRef.current.playing = playing;
    controlRef.current.reducedMotion = reducedMotion;
    controlRef.current.update();
  }, [playing, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    const stage = stageRef.current;
    if (!canvas || !probe || !stage) return;
    const container = canvas.parentElement ?? canvas;

    let cancelled = false;
    let cleanup = () => {};

    import("ogl").then(({ Renderer, Program, Mesh, Triangle, RenderTarget }) => {
      if (cancelled) return;
      const renderer = new Renderer({
        canvas,
        dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        antialias: false,
        powerPreference: "low-power",
      });
      const gl = renderer.gl;
      if (!renderer.isWebgl2) return;

      const packed = packScene(scene);
      const { bounds, margin } = scene;
      const worldMin = [bounds.x - margin, bounds.y - margin];
      const worldSize = [bounds.width + margin * 2, bounds.height + margin * 2];
      const segments = {
        uSegA: { value: packed.segA },
        uSegB: { value: packed.segB },
      };
      const view = {
        uRes: { value: [1, 1] },
        uOffset: { value: [0, 0] },
        uPx: { value: 0.01 },
      };
      const geometry = new Triangle(gl);
      const program = (
        fragment: string,
        uniforms: Record<string, { value: unknown }>,
        defines: Record<string, number> = {},
      ) =>
        new Program(gl, {
          vertex: VERTEX,
          fragment: withDefines(fragment, { ...packed.defines, ...defines }),
          uniforms,
          depthTest: false,
          depthWrite: false,
        });

      const fieldUniforms = {
        ...segments,
        uSourceBox: { value: packed.sourceBox },
        uSourceRounding: { value: packed.sourceRounding },
        uWorldMin: { value: worldMin },
        uWorldSize: { value: worldSize },
      };
      const bake = (pair: number) => {
        const target = new RenderTarget(gl, {
          width: Math.min(1024, Math.ceil(worldSize[0] * FIELD_TEXELS_PER_METER)),
          height: Math.min(1024, Math.ceil(worldSize[1] * FIELD_TEXELS_PER_METER)),
          depth: false,
          type: WebGL2RenderingContext.HALF_FLOAT,
          internalFormat: WebGL2RenderingContext.RGBA16F,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
        });
        const mesh = new Mesh(gl, {
          geometry,
          program: program(FIELD_FRAGMENT, fieldUniforms, { PAIR: pair }),
        });
        renderer.render({ scene: mesh, target });
        mesh.program.remove();
        return target;
      };
      const waveTargets = [bake(0)];
      if (packed.defines.SOURCE_COUNT > 2) waveTargets.push(bake(1));

      const inkTarget = new RenderTarget(gl, { width: 1, height: 1, depth: false });
      const inkMesh = new Mesh(gl, {
        geometry,
        program: program(INK_FRAGMENT, { ...segments, ...view }),
      });

      const colors = {
        uFg: { value: [0, 0, 0] as Rgb },
        uSound: { value: [0, 0, 0] as Rgb },
        uAlpha: { value: [0.4, 0.2, 0.1, 0.75] },
      };
      const time = { value: START_TIME };
      const spins = { value: Array.from({ length: SOURCE_SLOTS }, () => [0, 0]) };
      const compositeMesh = new Mesh(gl, {
        geometry,
        program: program(COMPOSITE_FRAGMENT, {
          ...view,
          ...colors,
          uInk: { value: inkTarget.texture },
          uWave0: { value: waveTargets[0].texture },
          uWave1: { value: waveTargets.at(-1)!.texture },
          uSpin: spins,
          uWorldMin: { value: worldMin },
          uWorldSize: { value: worldSize },
          uBounds: {
            value: [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height],
          },
          uFade: { value: margin * 0.8 },
        }),
      });

      const draw = () => {
        spins.value = spins.value.map((_, i) => spin(i, time.value));
        renderer.render({ scene: compositeMesh });
      };

      const readTheme = () => {
        colors.uFg.value = readColor(probe, "--foreground");
        colors.uSound.value = readColor(probe, "--sound");
        colors.uAlpha.value = prefersMoreContrast()
          ? [0.85, 0.5, 0.18, 0.95]
          : [0.38, 0.2, 0.09, 0.85];
      };

      const layout = () => {
        const canvasBox = container.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        if (canvasBox.width === 0 || stageBox.width === 0) return;
        renderer.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        renderer.setSize(canvasBox.width, canvasBox.height);
        const metersPerCssPx = bounds.width / stageBox.width;
        view.uRes.value = [gl.canvas.width, gl.canvas.height];
        view.uPx.value = metersPerCssPx / renderer.dpr;
        view.uOffset.value = [
          bounds.x - (stageBox.left - canvasBox.left) * metersPerCssPx,
          bounds.y - (stageBox.top - canvasBox.top) * metersPerCssPx,
        ];
        inkTarget.setSize(gl.canvas.width, gl.canvas.height);
        renderer.render({ scene: inkMesh, target: inkTarget });
      };

      let frame = 0;
      let last = 0;
      let onScreen = true;
      const animating = () =>
        controlRef.current.playing &&
        !controlRef.current.reducedMotion &&
        onScreen &&
        document.visibilityState === "visible";

      const tick = (now: number) => {
        time.value += Math.min((now - last) / 1000, 0.1);
        last = now;
        draw();
        frame = requestAnimationFrame(tick);
      };

      const update = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (controlRef.current.reducedMotion) time.value = START_TIME;
        if (animating()) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        } else {
          draw();
        }
      };
      controlRef.current.update = update;

      const relayout = () => {
        layout();
        update();
      };

      readTheme();
      layout();
      update();
      setReady(true);

      const resizeObserver = new ResizeObserver(relayout);
      resizeObserver.observe(container);
      resizeObserver.observe(stage);

      const intersectionObserver = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        update();
      });
      intersectionObserver.observe(container);

      const themeObserver = new MutationObserver(() => {
        readTheme();
        update();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-contrast", "data-palette", "class", "style"],
      });
      const themeQueries = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map(
        (query) => matchMedia(query),
      );
      const onThemeQuery = () => {
        readTheme();
        update();
      };
      themeQueries.forEach((query) => query.addEventListener("change", onThemeQuery));
      document.addEventListener("visibilitychange", update);

      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        frame = 0;
        controlRef.current.update = () => {};
      };
      const onContextRestored = () => setGeneration((g) => g + 1);
      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.addEventListener("webglcontextrestored", onContextRestored);

      cleanup = () => {
        cancelAnimationFrame(frame);
        controlRef.current.update = () => {};
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        themeObserver.disconnect();
        themeQueries.forEach((query) => query.removeEventListener("change", onThemeQuery));
        document.removeEventListener("visibilitychange", update);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        for (const mesh of [inkMesh, compositeMesh]) mesh.program.remove();
        for (const target of [...waveTargets, inkTarget]) {
          gl.deleteFramebuffer(target.buffer);
          for (const texture of target.textures) gl.deleteTexture(texture.texture);
        }
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [scene, stageRef, generation]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none transition-opacity duration-700 motion-reduce:transition-none ${
          ready ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
      <span ref={probeRef} hidden />
    </>
  );
}
