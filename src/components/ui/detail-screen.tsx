"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { PanelBackButton } from "@/components/ui/panel-back-button";
// Same breakpoint as the map dock, so Escape only goes back on the wide layout.
import { WIDE_QUERY } from "@/features/map/map-layout-config";
import { useMediaQuery } from "@/lib/use-media-query";
import { cx } from "@/lib/cx";

// A detail screen inside the wide dock or the phone sheet: back, title,
// scrolling body, optional sticky footer. Focus moves to the title on open
// so the new screen is announced. Escape goes back on wide screens.
export function DetailScreen({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
  footer,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Previous screen's name: the back button reads "Back to {backTo}". */
  backTo: string;
  onBack: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wide = useMediaQuery(WIDE_QUERY);

  useEffect(() => {
    titleRef.current?.focus({ focusVisible: true });
  }, [title]);

  useEffect(() => {
    if (!wide) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wide, onBack]);

  return (
    <section aria-labelledby={titleId} className={cx("flex h-full min-h-0 flex-col bg-background", className)}>
      <header className="flex items-center gap-1 px-1">
        <PanelBackButton label={`Back to ${backTo}`} onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h1 id={titleId} ref={titleRef} tabIndex={-1} className="text-lg break-words">
            {title}
          </h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">{children}</div>
      {footer ? <div className="shrink-0 border-t border-border bg-background px-3 py-3">{footer}</div> : null}
    </section>
  );
}
