import type { Metadata } from "next";
import { LogoMark, Wordmark } from "@/components/logo";
import { ModeSwitcher } from "./mode-switcher";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false },
};

const SWATCHES = [
  { name: "background", bg: "bg-background", fg: "text-foreground" },
  { name: "card", bg: "bg-card", fg: "text-card-foreground" },
  { name: "muted", bg: "bg-muted", fg: "text-muted-foreground" },
  { name: "primary", bg: "bg-primary", fg: "text-primary-foreground" },
  { name: "destructive", bg: "bg-destructive", fg: "text-destructive-foreground" },
];

const TYPE_SCALE = [
  { className: "text-3xl font-semibold", label: "text-3xl" },
  { className: "text-2xl font-semibold", label: "text-2xl" },
  { className: "text-xl font-medium", label: "text-xl" },
  { className: "text-base", label: "text-base (body)" },
  { className: "text-sm text-muted-foreground", label: "text-sm, muted" },
];

export default function StyleGuidePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Style guide</h1>
        <p className="text-muted-foreground">
          Every color below is a semantic token. Switch modes to check that
          components never need to know which one is on.
        </p>
      </header>

      <section aria-labelledby="modes" className="flex flex-col gap-3">
        <h2 id="modes" className="text-xl font-medium">
          Modes
        </h2>
        <ModeSwitcher />
      </section>

      <section aria-labelledby="colors" className="flex flex-col gap-3">
        <h2 id="colors" className="text-xl font-medium">
          Colors
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SWATCHES.map((s) => (
            <li
              key={s.name}
              className={`${s.bg} ${s.fg} rounded-md border border-input p-4`}
            >
              <span className="font-medium">{s.name}</span>
              <span className="block text-sm">Text on {s.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="logo" className="flex flex-col gap-3">
        <h2 id="logo" className="text-xl font-medium">
          Logo
        </h2>
        <p className="text-sm text-muted-foreground">
          The only serif on the site. The mark at 16, 32 and 64 pixels.
        </p>
        <div className="flex items-end gap-6">
          <LogoMark className="h-4 w-auto" />
          <LogoMark className="h-8 w-auto" />
          <LogoMark className="h-16 w-auto" />
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-auto" />
            <Wordmark className="h-6 w-auto" />
          </div>
        </div>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-3">
        <h2 id="type" className="text-xl font-medium">
          Type
        </h2>
        {TYPE_SCALE.map((t) => (
          <p key={t.label} className={t.className}>
            Quiet study spaces near you ({t.label})
          </p>
        ))}
      </section>

      <section aria-labelledby="focus" className="flex flex-col gap-3">
        <h2 id="focus" className="text-xl font-medium">
          Focus and controls
        </h2>
        <p className="text-muted-foreground">
          Press Tab to move through these and check the focus ring.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Check in
          </button>
          <button
            type="button"
            className="rounded-md border border-input px-4 py-2 hover:bg-accent"
          >
            Show list
          </button>
          <button
            type="button"
            className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground"
          >
            Delete check-in
          </button>
          <a href="#modes" className="self-center text-primary underline">
            Back to modes
          </a>
        </div>
        <label className="flex max-w-sm flex-col gap-1">
          Search spaces
          <input
            type="search"
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
      </section>
    </main>
  );
}
