import Link from "next/link";
import { FootnoteRef } from "@/components/footnote-ref";
import { ROUTES } from "@/lib/site";

const CONDITIONS = [
  {
    title: "Noise",
    body: "From silent floors to places where talking is fine.",
  },
  {
    title: "Light",
    body: "Dim, moderate or bright, and whether there's natural light.",
  },
  {
    title: "Busyness",
    body: "How full a space was at the latest check-in, and how long ago that was.",
  },
  {
    title: "Access",
    body: "Step-free entry, all-gender restrooms nearby, outlets and whiteboards.",
  },
];

const STEPS = [
  {
    title: "Browse",
    body: "Open the map or the list and filter out anything too loud, too bright or too crowded.",
  },
  {
    title: "Pick a space",
    body: "See its official features and what other students have reported recently.",
  },
  {
    title: "Check in",
    body: "Signed in with your @umich.edu account, tell others what it's like right now. It takes a few taps.",
  },
];

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 font-medium";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:py-16">
      <section aria-labelledby="hero" className="flex max-w-2xl flex-col gap-6">
        <h1 id="hero" className="text-4xl sm:text-5xl">
          Find a study space that feels right.
        </h1>
        <p className="text-lg text-muted-foreground">
          Search campus by noise, light, crowding and access, before you walk
          over. Starting with U-M Library study spaces
          <FootnoteRef id="library-spaces" />.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={ROUTES.map}
            className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            Open the map
          </Link>
          <Link
            href="#how-it-works"
            className={`${buttonBase} border border-input hover:bg-accent`}
          >
            How it works
          </Link>
        </div>
      </section>

      <section aria-labelledby="conditions" className="flex flex-col gap-6">
        <h2 id="conditions" className="text-2xl">
          Filter by how a space feels
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONDITIONS.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 text-card-foreground"
            >
              <h3 className="text-lg">{item.title}</h3>
              <p className="text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="flex scroll-mt-4 flex-col gap-6"
      >
        <h2 id="how-it-works-heading" className="text-2xl">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border border-input text-sm font-semibold">
                {index + 1}
              </span>
              <h3 className="text-lg">{step.title}</h3>
              <p className="text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="privacy"
        className="flex flex-col gap-3 rounded-lg bg-muted p-6 sm:p-8"
      >
        <h2 id="privacy" className="text-2xl">
          Anonymous by design
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Check-ins describe the space, never the person. Nobody can see who
          checked in where; everyone sees the same totals.
        </p>
        <Link
          href={ROUTES.privacy}
          className="self-start rounded-sm text-primary underline underline-offset-4"
        >
          Read the privacy policy
        </Link>
      </section>

      <section aria-labelledby="get-started" className="flex flex-col items-start gap-4">
        <h2 id="get-started" className="text-2xl">
          Ready to find somewhere quiet?
        </h2>
        <p className="text-muted-foreground">
          Browsing is open to everyone. Sign up only when you want to check in.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={ROUTES.map}
            className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            Open the map
          </Link>
          <Link
            href={ROUTES.signIn}
            className={`${buttonBase} border border-input hover:bg-accent`}
          >
            Sign up
          </Link>
        </div>
      </section>
    </div>
  );
}
