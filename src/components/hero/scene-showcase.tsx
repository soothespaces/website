"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PageWidth } from "@/components/page-width";
import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon } from "@/components/ui/icons";
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
      <PageWidth className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:py-24">
        <div className="flex flex-col gap-6">{children}</div>
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
              <span className="-ml-1 h-px w-6 shrink-0 bg-primary/60 sm:w-20" />
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
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              shape="circle"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause animation" : "Play animation"}
              className="absolute right-0 bottom-0 bg-card/80 text-muted-foreground hover:text-foreground"
            >
              {playing ? <PauseIcon size="sm" /> : <PlayIcon size="sm" />}
            </Button>
          )}
        </figure>
      </PageWidth>
    </section>
  );
}
