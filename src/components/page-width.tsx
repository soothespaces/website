import type { ReactNode } from "react";

// The only page column. Width and gutter come from --page-width and
// --page-gutter. See .page-width in globals.css.
export function PageWidth({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-page-width
      className={className ? `page-width ${className}` : "page-width"}
    >
      {children}
    </div>
  );
}
