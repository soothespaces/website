import type { ReactNode } from "react";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { ROUTES } from "@/lib/site";

export const LEGAL_UPDATED = "2026-10-08";
export const LEGAL_UPDATED_LABEL = "October 8, 2026";

// Uniqnames from docs/product/overview.md. UM addresses are uniqname@umich.edu.
export const TEAM_CONTACTS = [
  { name: "Tanner Aslan", email: "tkaslan@umich.edu" },
  { name: "Gjonpjer Kola", email: "gjonpjer@umich.edu" },
  { name: "Calvin Yi", email: "calvinyi@umich.edu" },
  { name: "Mark Zhu", email: "markzhu@umich.edu" },
] as const;

const linkClassName = "rounded-sm text-primary underline underline-offset-4";

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={linkClassName}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={linkClassName}>
      {children}
    </a>
  );
}

export function LegalContact() {
  return (
    <>
      <p>
        Soothe Spaces is maintained by Tanner Aslan, Gjonpjer Kola, Calvin Yi,
        and Mark Zhu, students at the University of Michigan. To ask about the
        privacy policy or the terms of service, or to delete an account and
        the check-ins tied to it, email the team from the @umich.edu address
        on that account:
      </p>
      <ul>
        {TEAM_CONTACTS.map((person) => (
          <li key={person.email}>
            {person.name},{" "}
            <LegalLink href={`mailto:${person.email}`}>{person.email}</LegalLink>
          </li>
        ))}
      </ul>
      <p>
        Do not post a deletion request in a public place. Include the email
        address on the account so we can tell the request is yours.
      </p>
    </>
  );
}

export function LegalDocument({
  title,
  intro,
  sections,
  current,
}: {
  title: string;
  intro: ReactNode;
  sections: { id: string; title: string; body: ReactNode }[];
  current: "privacy" | "terms";
}) {
  return (
    <ContentPage title={title} intro={intro}>
      <p className="text-sm text-muted-foreground">
        Last updated <time dateTime={LEGAL_UPDATED}>{LEGAL_UPDATED_LABEL}</time>.
      </p>
      <p className="rounded-md border border-input bg-muted p-4 text-sm">
        Soothe Spaces is a student project. It is not run or endorsed by the
        University of Michigan.
      </p>

      <nav aria-labelledby="on-this-page" className="flex flex-col gap-2">
        <h2 id="on-this-page" className="text-xl">
          On this page
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={linkClassName}>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="flex scroll-mt-4 flex-col gap-3"
        >
          <h2 id={`${section.id}-heading`} className="text-2xl">
            {section.title}
          </h2>
          <div className="flex flex-col gap-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {section.body}
          </div>
        </section>
      ))}

      <nav
        aria-labelledby="related-policies"
        className="flex flex-col gap-2 border-t border-border pt-8"
      >
        <h2 id="related-policies" className="text-xl">
          Related
        </h2>
        <ul className="flex flex-col gap-1">
          <li>
            {current === "privacy" ? (
              <span aria-current="page">Privacy policy</span>
            ) : (
              <LegalLink href={ROUTES.privacy}>Privacy policy</LegalLink>
            )}
          </li>
          <li>
            {current === "terms" ? (
              <span aria-current="page">Terms of service</span>
            ) : (
              <LegalLink href={ROUTES.terms}>Terms of service</LegalLink>
            )}
          </li>
        </ul>
      </nav>
    </ContentPage>
  );
}
