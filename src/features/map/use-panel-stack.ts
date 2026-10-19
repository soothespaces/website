"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  HOME_ROUTE,
  backRoute,
  normalizePanelStack,
  panelHref,
  parsePanelRoute,
  pushRoute,
  reconcileStack,
  resetRoute,
  samePanelRoute,
  samePanelStack,
  stackForRoute,
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
  return typeof state[INDEX_KEY] === "number" && state[INDEX_KEY] >= 0 ? state[INDEX_KEY] : 0;
}

function writeHistory(mode: "push" | "replace", stack: PanelRoute[]) {
  const state = historyRecord();
  const next = {
    ...state,
    [STACK_KEY]: stack,
    [INDEX_KEY]: mode === "push" ? historyIndex(state) + 1 : historyIndex(state),
  };
  const top = stack.at(-1) ?? HOME_ROUTE;
  const href = panelHref(window.location.pathname, top, new URLSearchParams(window.location.search));
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

// The panel stack, mirrored to the query string with history.pushState so
// the browser's Back button pops it. Next patches pushState and updates
// useSearchParams; see the App Router linking guide.
export function usePanelStack() {
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const [stack, setStack] = useState<PanelRoute[]>(() => stackForRoute(parsePanelRoute(searchParams)));
  const [seenUrl, setSeenUrl] = useState(urlKey);
  const stackRef = useRef(stack);

  // The query changed outside this hook's own push (browser Back, or another
  // feature editing the URL). Adopt that route before paint.
  if (urlKey !== seenUrl) {
    const next = stackMatching(searchParams, historyStack(), stack);
    setSeenUrl(urlKey);
    if (!samePanelStack(next, stack)) setStack(next);
  }

  const apply = useCallback((next: PanelRoute[], mode: "push" | "replace") => {
    stackRef.current = next;
    setStack(next);
    writeHistory(mode, next);
  }, []);

  const push = useCallback(
    (route: PanelRoute) => {
      const next = pushRoute(stackRef.current, route);
      if (next === stackRef.current) return false;
      apply(next, "push");
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

  // Attach the seeded stack to the entry a shared link landed on. Parents
  // such as Building under Hours are not their own history entries yet.
  useLayoutEffect(() => {
    const state = historyRecord();
    const stored = normalizePanelStack(state[STACK_KEY]);
    if (stored && samePanelStack(stored, stackRef.current)) return;
    writeHistory("replace", stackRef.current);
  }, []);

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

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  return {
    stack,
    route: stack.at(-1) ?? HOME_ROUTE,
    canGoBack: stack.length > 1,
    push,
    back,
    reset,
  };
}
