"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckInSheet } from "./check-in-sheet";
import type { CheckInRequest, OpenCheckIn } from "./check-in-request";

export type { CheckInRequest, OpenCheckIn };

type CheckInController = {
  openCheckIn: (options?: OpenCheckIn) => void;
  closeCheckIn: () => void;
};

const CheckInContext = createContext<CheckInController | null>(null);

export function useCheckIn(): CheckInController | null {
  return useContext(CheckInContext);
}

export function CheckInProvider({ children }: { children: ReactNode }) {
  const idRef = useRef(0);
  const [request, setRequest] = useState<CheckInRequest | null>(null);
  const [open, setOpen] = useState(false);

  const openCheckIn = useCallback((options: OpenCheckIn = {}) => {
    idRef.current += 1;
    setRequest({ ...options, id: idRef.current });
    setOpen(true);
  }, []);

  const closeCheckIn = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openCheckIn, closeCheckIn }), [openCheckIn, closeCheckIn]);

  return (
    <CheckInContext.Provider value={value}>
      {children}
      <CheckInSheet
        open={open}
        request={request}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      />
    </CheckInContext.Provider>
  );
}
