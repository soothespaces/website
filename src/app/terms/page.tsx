import type { Metadata } from "next";
import { LegalContact, LegalDocument, LegalLink } from "@/components/legal-document";
import { ROUTES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The rules for using Soothe Spaces, including anonymous check-ins, campus data, and what the site does not guarantee.",
};

const SECTIONS = [
  {
    id: "student-project",
    title: "A student project",
    body: (
      <p>
        Soothe Spaces is built by University of Michigan students. It is not a
        University service, and it is not run or endorsed by the University of
        Michigan, the University Library, or Services for Students with
        Disabilities.
      </p>
    ),
  },
  {
    id: "purpose",
    title: "What the site is for",
    body: (
      <>
        <p>
          The site helps you look for study spaces using environmental
          information: noise, light, busyness, and access. Some of that
          information comes from the University Library and other public campus
          sources. Some of it comes from student check-ins.
        </p>
        <p>The site is a guide. It is not:</p>
        <ul>
          <li>Medical, clinical, or mental-health advice</li>
          <li>
            An official disability accommodation, or a determination that a
            space meets one
          </li>
          <li>
            A guarantee that a room is quiet, empty, step-free, or open when you
            arrive
          </li>
          <li>A way to book a room inside Soothe Spaces</li>
        </ul>
        <p>
          If you depend on step-free access, an all-gender restroom, or a room
          reservation, confirm it with the building or the library. Campus
          conditions change, and a check-in can be wrong or out of date. Where
          there are no recent check-ins, the site says so. It does not guess.
        </p>
      </>
    ),
  },
  {
    id: "who",
    title: "Who can use it",
    body: (
      <>
        <p>
          Anyone may browse and read aggregated check-ins. Submitting a check-in
          requires a Google account on @umich.edu. You must be allowed to use
          that account. We reject sign-in that is not on that domain. There is
          no separate password for Soothe Spaces.
        </p>
        <p>
          The service is not for children under 13. How accounts and check-ins
          are stored is described in the{" "}
          <LegalLink href={ROUTES.privacy}>privacy policy</LegalLink>.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <p>
        You are responsible for activity from your account. Do not share access
        in order to get around the @umich.edu requirement. We may refuse, limit,
        or close an account that breaks these terms, including an account used
        to submit misleading check-ins or to try to identify other people.
      </p>
    ),
  },
  {
    id: "check-ins",
    title: "Check-ins",
    body: (
      <>
        <p>
          A check-in is a short, structured report about a space you were
          actually in. There is no free-text review and no star rating. When you
          check in, you agree that:
        </p>
        <ul>
          <li>You are describing the space, not a person</li>
          <li>
            You were there at the time you select. You may choose now, or
            earlier the same day. You may not file a check-in for some other day
          </li>
          <li>
            The answers are your honest impression, not an attempt to mislead
            other students
          </li>
          <li>
            You will not try to add information about someone&apos;s health,
            disability, or identity. The form does not ask for it
          </li>
        </ul>
        <p>
          We store your account id on the check-in only to limit repeat
          submissions to the same space and to handle abuse. Other users see
          totals only, with recent times rounded to about 15 minutes. You must
          not try to work out who submitted a check-in from those totals.
        </p>
        <p>
          You give the project permission to store your check-in and to show it
          to the public only as part of those anonymous totals, for as long as
          we keep the row. You can ask us to delete your rows, as described in
          the privacy policy. Deleting them removes them from totals going
          forward.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Do not:</p>
        <ul>
          <li>
            Submit check-ins for spaces you have not been in, or submit them to
            skew the totals
          </li>
          <li>
            Attempt to read, scrape, or infer another person&apos;s check-ins,
            account, or needs profile
          </li>
          <li>
            Bypass the @umich.edu sign-in limit, or probe the database for raw
            rows
          </li>
          <li>
            Interfere with the site, or overload the University systems we read,
            including library booking pages and campus map data
          </li>
          <li>Use the site to harass anyone</li>
          <li>Present Soothe Spaces as an official University service</li>
        </ul>
        <p>
          Photos of spaces, and submissions of new places, are not part of the
          service today. If we add them, you may only submit material you have
          the right to share, it must describe a place rather than a person, and
          photos would be shown only under a moderation process.
        </p>
        <p>
          An optional noise sample is not offered today. If we add one, it is
          measured on your device and you would send only a relative level. We
          do not accept audio recordings.
        </p>
      </>
    ),
  },
  {
    id: "campus-data",
    title: "Campus information and the map",
    body: (
      <>
        <p>
          Space features, floor plans, building access notes, and similar
          material come from University and public sources, including{" "}
          <LegalLink href="https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/">
            U-M Library Find Study Space
          </LegalLink>
          ,{" "}
          <LegalLink href="https://mprint.umich.edu/">MPrint</LegalLink> floor
          plans, and the campus map. That material stays under its owners&apos;
          terms. We display it so you can find a space. We do not grant you any
          license to republish it beyond what those sources already allow.
        </p>
        <p>
          The map uses OpenStreetMap data, ©{" "}
          <LegalLink href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </LegalLink>
          , available under the{" "}
          <LegalLink href="https://opendatacommons.org/licenses/odbl/">
            Open Database License
          </LegalLink>
          . Attribution stays visible on the map. You may not strip it off or
          present the map data as your own.
        </p>
        <p>
          We do not take crowd levels from Google Popular Times. Scraping Google
          Maps would break Google&apos;s terms, so the site does not do it. Live
          busyness, where we have it, comes from Waitz for that building or from
          recent check-ins. It describes the place, and it can lag.
        </p>
      </>
    ),
  },
  {
    id: "booking",
    title: "Rooms and booking",
    body: (
      <p>
        If the site shows that a library room or seat looks free, that
        information is read-only and may be cached for several minutes. Soothe
        Spaces does not create, change, or cancel a booking. A Book link leaves
        this site for the library&apos;s LibCal page, where you sign in with
        your University account and where LibCal&apos;s rules and the
        library&apos;s rules apply. We never store who booked a room.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "No warranty",
    body: (
      <p>
        The site is provided as-is, by students, without a warranty of accuracy,
        availability, or fitness for a particular purpose, to the extent the law
        allows. The student team is not liable for lost time, a missed booking,
        or injury or inconvenience from relying on a noise level, an access
        note, a floor plan, or an availability badge. Some jurisdictions do not
        allow certain limitations. In those cases the limitation applies only as
        far as the law allows.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Stopping or ending use",
    body: (
      <p>
        You may stop using the site at any time, and you may ask us to delete
        your account. We may stop operating the project, or remove a feature.
        It is a class project with a fixed team, not an ongoing University
        service.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        If these terms change, we will update the date at the top of this page.
        Continuing to use the site after that date means you accept the updated
        terms. If you do not accept them, stop using the site and ask us to
        delete your account.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the State of Michigan, without
        regard to conflict-of-law rules.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <LegalContact />,
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of service"
      intro="The ground rules for using Soothe Spaces. By using the site, you agree to them."
      sections={SECTIONS}
      current="terms"
    />
  );
}
