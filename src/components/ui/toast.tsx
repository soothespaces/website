"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "./button";
import { CloseIcon } from "./icons";

// Brief confirmations ("Checked in at Shapiro"). Radix announces them through
// a live region, pauses the timer on hover and focus, and F8 jumps to them.
// Don't put the only way to do something in a toast; it disappears.
//
//   const toast = useToast();
//   toast({ title: "Checked in", description: "Shapiro Library, 2nd floor" });

type ToastInput = {
  title: string;
  description?: string;
  /** Milliseconds; default 5000. */
  duration?: number;
};

type ToastItem = ToastInput & { id: number; open: boolean };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast needs <Toaster> in the root layout.");
  return show;
}

let nextId = 0;

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((toast: ToastInput) => {
    nextId += 1;
    setToasts((current) => [...current, { ...toast, id: nextId, open: true }]);
  }, []);

  function close(id: number) {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, open: false } : t)));
    // Remove after the exit animation.
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 200);
  }

  return (
    <ToastContext.Provider value={show}>
      <ToastPrimitive.Provider swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            open={toast.open}
            duration={toast.duration ?? 5000}
            onOpenChange={(open) => (open ? null : close(toast.id))}
            className="relative flex items-start gap-3 rounded-lg border border-border bg-popover p-4 pr-12 text-popover-foreground shadow-lg data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out data-[swipe=end]:animate-fade-out"
          >
            <div className="flex flex-col gap-1">
              <ToastPrimitive.Title className="font-medium">{toast.title}</ToastPrimitive.Title>
              {toast.description ? (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {toast.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Dismiss" className="absolute top-2 right-2">
                <CloseIcon />
              </Button>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 left-1/2 z-[60] flex w-[min(24rem,100%)] -translate-x-1/2 flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
