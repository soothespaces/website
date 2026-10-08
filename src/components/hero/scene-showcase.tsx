"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SpaceChip } from "@/components/ui/space-chip";
import { SceneCanvas } from "./scene-canvas";
import type { StudyScene } from "./scenes";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true" focusable="false">
      {playing ? (
        <path d="M4.5 3h2.25v10H4.5zM9.25 3h2.25v10H9.25z" />
      ) : (
        <path d="M5 3.2v9.6a.5.5 0 0 0 .77.42l7.4-4.8a.5.5 0 0 0 0-.84l-7.4-4.8A.5.5 0 0 0 5 3.2z" />
      )}
    </svg>
  );
}

// A study spot drawn as a top-down floor plan, with its chip pinned to it.
// `children` is the copy beside it; `labelledBy` is the id of its heading.
export function SceneShowcase({
  scene,
  labelledBy,
  children,
}: {
  scene: StudyScene;
  labelledBy: string;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const reducedMotion = useReducedMotion();
  const { bounds, pin } = scene;
  const pinLeft = ((pin[0] - bounds.x) / bounds.width) * 100;
  const pinTop = ((pin[1] - bounds.y) / bounds.height) * 100;

  return (
    <section aria-labelledby={labelledBy} className="relative isolate overflow-hidden">
      <SceneCanvas
        scene={scene}
        stageRef={stageRef}
        playing={playing}
        reducedMotion={reducedMotion}
        className="absolute inset-0 -z-10 size-full"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:py-24">
        <div className="flex max-w-xl flex-col gap-6">{children}</div>
        <figure
          ref={stageRef}
          className="relative w-full translate-x-[6%]"
          style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}
        >
          <figcaption className="sr-only">
            Illustration: sound spreading from two group tables across an open
            commons and reaching a quiet table, with two dividing walls casting
            acoustic shadows.
          </figcaption>
          {scene.chipSide === "right" ? (
            <div
              className="absolute right-0 flex -translate-x-1.5 -translate-y-1/2 items-center"
              style={{ left: `${pinLeft}%`, top: `${pinTop}%` }}
            >
              <span className="size-3 shrink-0 rounded-full border-2 border-card bg-primary shadow-sm" />
              <span className="-ml-1 h-px w-6 shrink-0 bg-primary/60 sm:w-10" />
              <div className="min-w-0 flex-1">
                <SpaceChip {...scene.chip} />
              </div>
            </div>
          ) : (
            <div
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pinLeft}%`, top: `${pinTop}%` }}
            >
              <span className="size-3 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm" />
              <span className="-mt-1 h-9 w-px bg-primary/60" />
              <SpaceChip {...scene.chip} />
            </div>
          )}
          {reducedMotion ? null : (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              className="absolute right-0 bottom-0 inline-flex size-9 items-center justify-center rounded-full border border-input bg-card/80 text-muted-foreground hover:text-foreground"
            >
              <PlayPauseIcon playing={playing} />
              <span className="sr-only">Pause animation</span>
            </button>
          )}
        </figure>
      </div>
    </section>
  );
}
