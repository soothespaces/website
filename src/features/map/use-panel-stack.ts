"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  HOME_ROUTE,
  backRoute,
  normalizePanelStack,
  panelHref,
  panelSearchForStack,
  parsePanelRoute,
  planPush,
  reconcileStack,
  resetRoute,
  samePanelRoute,
  samePanelStack,
  type PanelRoute,
} from "@/features/side-view/panel-route";

// Kept on the history entry beside Next's own state. The index counts pushes
// made from this entry, so panel Back can use the browser's Back when the
// previous entry is the parent screen and a plain replace when it isn't
// (a shared link's parents were never visited).
const STACK_KEY = "soothePanelStack";
const INDEX_KEY = "soothePanelIndex";

function historyRecord(): Record<string, unknown> {
  const state = window.history.state;
  return state && typeof state === "object" ? (state as Record<string, unknown>) : {};
}

function historyIndex(state: Record<string, unknown>) {
  const value = state[INDEX_KEY];
  return typeof value === "number" && value >= 0 ? value : 0;
}

function writeHistory(mode: "push" | "replace", stack: PanelRoute[]) {
  const state = historyRecord();
  const index = historyIndex(state);
  // A fresh object, not a copy of history.state. Next 16.4's patched
  // pushState skips the router update when the state already has its `__NA`
  // flag, which would leave useSearchParams on the previous query. Next
  // copies `__NA` and its tree onto this object itself, and keeps these keys.
  const next = {
    [STACK_KEY]: stack,
    [INDEX_KEY]: mode === "push" ? index + 1 : index,
  };
  const top = stack.at(-1) ?? HOME_ROUTE;
  const href = panelHref(
    window.location.pathname,
    top,
    panelSearchForStack(stack, new URLSearchParams(window.location.search)),
  );
  const current = `${window.location.pathname}${window.location.search}`;
  if (mode === "replace" && href === current && samePanelStack(normalizePanelStack(state[STACK_KEY]) ?? [], stack)) {
    return;
  }
  if (mode === "push") window.history.pushState(next, "", href);
  else window.history.replaceState(next, "", href);
}

function historyStack(): unknown {
  if (typeof window === "undefined") return undefined;
  return historyRecord()[STACK_KEY];
}

function stackMatching(params: URLSearchParams, stored: unknown, fallback: PanelRoute[]) {
  const route = parsePanelRoute(params);
  const stack = normalizePanelStack(stored);
  if (stack && samePanelRoute(stack.at(-1), route)) return stack;
  return reconcileStack(fallback, route);
}

// The panel stack. The shell renders without reading the query string; 
// `PanelQuerySync` (under a small Suspense boundary) adopts the URL and
// keeps `useSearchParams` current. `pushState` is what the App Router
// linking guide uses for query updates.
export function usePanelStack() {
  const [stack, setStack] = useState<PanelRoute[]>([HOME_ROUTE]);
  const stackRef = useRef(stack);

  const adoptUrl = useCallback((params: URLSearchParams) => {
    const next = stackMatching(params, historyStack(), stackRef.current);
    if (!samePanelStack(next, stackRef.current)) {
      stackRef.current = next;
      setStack(next);
    }
    const top = stackRef.current.at(-1) ?? HOME_ROUTE;
    if (!samePanelRoute(parsePanelRoute(params), top)) return;
    writeHistory("replace", stackRef.current);
  }, []);

  const apply = useCallback((next: PanelRoute[], mode: "push" | "replace") => {
    stackRef.current = next;
    setStack(next);
    writeHistory(mode, next);
  }, []);

  const push = useCallback(
    (route: PanelRoute) => {
      const plan = planPush(stackRef.current, route, historyIndex(historyRecord()));
      if (plan.type === "none") return false;
      if (plan.type === "back") {
        window.history.go(-plan.steps);
        return true;
      }
      apply(plan.stack, plan.type);
      return true;
    },
    [apply],
  );

  const reset = useCallback((route: PanelRoute) => apply(resetRoute(route), "replace"), [apply]);

  const back = useCallback(() => {
    const current = stackRef.current;
    if (current.length <= 1) return;
    // A push wrote this entry, so the previous one is the parent screen.
    if (historyIndex(historyRecord()) > 0) {
      window.history.back();
      return;
    }
    apply(backRoute(current), "replace");
  }, [apply]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state && typeof event.state === "object" ? (event.state as Record<string, unknown>) : {};
      const next = stackMatching(new URLSearchParams(window.location.search), state[STACK_KEY], stackRef.current);
      stackRef.current = next;
      setStack(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return {
    stack,
    route: stack.at(-1) ?? HOME_ROUTE,
    canGoBack: stack.length > 1,
    push,
    back,
    reset,
    adoptUrl,
  };
}

// Reads the query string. Rendered under Suspense so the dock and the map
// stay in the prerendered page.
export function PanelQuerySync({ onParams }: { onParams: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const onParamsRef = useRef(onParams);

  useLayoutEffect(() => {
    onParamsRef.current = onParams;
    onParamsRef.current(searchParams);
  }, [urlKey, onParams, searchParams]);

  return null;
}
