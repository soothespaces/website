import Link from "next/link";
import { FOOTNOTES, HELP_TOPICS, ROUTES } from "@/lib/site";
import { LogoMark } from "./logo";
import { PageWidth } from "./page-width";

const NOTICES = [
  "Soothe Spaces is a student project. It is not run or endorsed by the University of Michigan.",
  "Noise, light and busyness are reported by students and can change quickly. Check the time of the latest check-in before you go.",
  "Check-ins are anonymous. Only totals are ever shown.",
];

const linkClassName =
  "rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-border text-sm">
      <PageWidth className="grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr]">
        <section aria-labelledby="footer-notices" className="flex flex-col gap-3">
          <LogoMark className="h-8 w-auto self-start" />
          <h2 id="footer-notices" className="text-base">
            Notices
          </h2>
          <ul className="flex flex-col gap-2 text-muted-foreground">
            {NOTICES.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </section>

        <nav aria-labelledby="footer-help" className="flex flex-col gap-3">
          <h2 id="footer-help" className="text-base">
            Questions and answers
          </h2>
          <ul className="flex flex-col gap-2">
            {HELP_TOPICS.map((topic) => (
              <li key={topic.id}>
                <Link href={`${ROUTES.help}#${topic.id}`} className={linkClassName}>
                  {topic.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href={ROUTES.help} className={linkClassName}>
                All questions
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal" className="flex flex-col gap-3">
          <h2 id="footer-legal" className="text-base">
            Legal
          </h2>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href={ROUTES.privacy} className={linkClassName}>
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href={ROUTES.terms} className={linkClassName}>
                Terms of service
              </Link>
            </li>
          </ul>
        </nav>
      </PageWidth>

      <div className="border-t border-border">
        <PageWidth className="flex flex-col gap-4 py-6 text-muted-foreground">
          <section aria-labelledby="footer-footnotes" className="flex flex-col gap-2">
            <h2 id="footer-footnotes" className="text-sm text-foreground">
              Footnotes
            </h2>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {FOOTNOTES.map((note) => (
                <li key={note.id} id={`footnote-${note.id}`} className="scroll-mt-4">
                  {note.text}{" "}
                  <a href={note.href} className={`${linkClassName} underline`}>
                    {note.source}
                  </a>
                </li>
              ))}
            </ol>
          </section>
          <p>© {new Date().getFullYear()} Soothe Spaces</p>
        </PageWidth>
      </div>
    </footer>
  );
}
