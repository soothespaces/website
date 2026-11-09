"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { PanelBackButton } from "@/components/ui/panel-back-button";
import { cx } from "@/lib/cx";

// A detail screen inside the wide dock or the phone sheet: back, title,
// scrolling body, optional sticky footer. Focus moves to the title on open
// so the new screen is announced. Escape goes back, in the dock and in the
// phone sheet (QA-008).
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

  useEffect(() => {
    titleRef.current?.focus({ focusVisible: true });
  }, [title]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onBack();
  }

  return (
    <section
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className={cx("flex h-full min-h-0 flex-col bg-background", className)}
    >
      <header className="flex items-center gap-1 border-b border-border px-1 pt-1 pb-2">
        <PanelBackButton label={backTo ? `Back to ${backTo}` : "Back"} onClick={onBack} icon={<ChevronLeftIcon />} />
        <div className="min-w-0 flex-1">
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-lg break-words">
            {title}
          </h2>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>
      {/* flex-auto keeps the body content-sized when the frame has no fixed
          height (the collapsed phone sheet) and still shrinks to scroll when
          the frame is bounded, so a footer can sit at the bottom.
          data-detail-scroll is the element the panel restores on Back. */}
      <div data-detail-scroll="" className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-3 py-2">
        {children}
      </div>
      {footer ? <div className="shrink-0 border-t border-border bg-background px-3 py-3">{footer}</div> : null}
    </section>
  );
}
