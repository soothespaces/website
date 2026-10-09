"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PageWidth } from "@/components/page-width";
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

export function LandingHero({ scene, children }: { scene: StudyScene; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const reducedMotion = useReducedMotion();
  const { bounds, pin } = scene;
  const pinLeft = ((pin[0] - bounds.x) / bounds.width) * 100;
  const pinTop = ((pin[1] - bounds.y) / bounds.height) * 100;

  return (
    <section aria-labelledby="hero" className="relative isolate overflow-hidden">
      <SceneCanvas
        scene={scene}
        stageRef={stageRef}
        playing={playing}
        reducedMotion={reducedMotion}
        className="absolute inset-0 -z-10 size-full"
      />
      <PageWidth className="grid items-center gap-10 pt-12 pb-28 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:pt-24 lg:pb-32">
        <div className="flex flex-col gap-6">{children}</div>
        <figure
          ref={stageRef}
          className="relative w-full"
          style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}
        >
          <figcaption className="sr-only">
            Illustration: sound spreading from group tables across an open commons.
          </figcaption>
          <div
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pinLeft}%`, top: `${pinTop}%` }}
          >
            <span className="size-3 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm" />
            <span className="-mt-1 h-4 w-px bg-primary/60" />
            <SpaceChip {...scene.chip} />
          </div>
          {reducedMotion ? null : (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              className="absolute top-0 right-0 inline-flex size-9 items-center justify-center rounded-full border border-input bg-card/80 text-muted-foreground hover:text-foreground"
            >
              <PlayPauseIcon playing={playing} />
              <span className="sr-only">Pause animation</span>
            </button>
          )}
        </figure>
      </PageWidth>
    </section>
  );
}
