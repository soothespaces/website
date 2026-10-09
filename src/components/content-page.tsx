import type { ReactNode } from "react";

// Layout for text pages: help, legal and placeholder pages.
export function ContentPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {intro ? <p className="text-lg text-muted-foreground">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-input bg-muted p-4 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">Placeholder. </span>
      {children}
    </p>
  );
}
