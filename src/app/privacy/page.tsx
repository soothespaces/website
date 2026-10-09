import type { Metadata } from "next";
import { LegalContact, LegalDocument, LegalLink } from "@/components/legal-document";
import { ROUTES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Soothe Spaces collects, why check-ins stay anonymous, and how to delete your account.",
};

const SECTIONS = [
  {
    id: "what-this-covers",
    title: "What this policy covers",
    body: (
      <>
        <p>
          Soothe Spaces is a campus map for finding study spaces by how they
          feel: noise, light, how busy they are, and whether you can get in
          step-free. This policy describes the information the project handles
          when you browse, sign in, or check in.
        </p>
        <p>
          The rules for using the site are in the{" "}
          <LegalLink href={ROUTES.terms}>terms of service</LegalLink>.
        </p>
      </>
    ),
  },
  {
    id: "browsing",
    title: "Browsing without an account",
    body: (
      <>
        <p>
          Anyone can open the map, read space details, and read check-in totals
          without signing in. Browsing does not require your name, your email,
          or your device location. We do not ask for GPS, and we do not use it
          to decide which floor or room you are in.
        </p>
        <p>
          Loading the site sends ordinary connection data, such as your IP
          address, the time, and your browser type, to our host so the page can
          be delivered and protected. Opening the map also asks an
          OpenStreetMap tile service for map images. That service sees the
          request your browser makes. We do not use connection data to build an
          advertising profile, and we do not attach it to a check-in.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Account information",
    body: (
      <>
        <p>
          Checking in requires sign-in with Google, limited to @umich.edu
          addresses. Sign-in is passwordless. We never see or store your Google
          password.
        </p>
        <p>From Google we receive only:</p>
        <ul>
          <li>Your name</li>
          <li>Your email address</li>
          <li>An account identifier Google and our auth provider use for you</li>
        </ul>
        <p>
          We do not ask Google for your Drive, Calendar, contacts, or any other
          Google data. We do not receive University education records such as
          grades, enrollment, or financial aid. A @umich.edu sign-in does not
          give us access to your student record.
        </p>
        <p>
          The account is stored with Supabase Auth so we can accept a check-in
          only from a signed-in @umich.edu account. A Google account on any
          other domain cannot submit a check-in. When you sign in, a session
          cookie keeps you signed in. That cookie is required for the account.
          It is not an advertising cookie.
        </p>
      </>
    ),
  },
  {
    id: "check-ins",
    title: "Check-ins",
    body: (
      <>
        <p>
          A check-in is a structured note about a space, not a written review.
          There is no free-text field and no star rating. It records:
        </p>
        <ul>
          <li>Noise: quiet, low noise, conversational, or loud</li>
          <li>Light: dim, moderate, or bright, and whether there is natural light</li>
          <li>
            Busyness: empty, some seats, half full, mostly full, or packed
          </li>
          <li>How easy the space is to focus in, on a five-point scale</li>
          <li>
            Features you saw, such as outlets, whiteboards, step-free access, or
            an all-gender restroom nearby
          </li>
          <li>When you were there: now, or earlier the same day</li>
        </ul>
        <p>
          The stored row includes your account id and a timestamp. The account
          id is kept only to limit repeat check-ins to the same space (for
          example, one per space per account per hour) and to handle abuse. It
          is never shown on a page.
        </p>
        <p>
          Other people, including guests, can see aggregates only: counts, how
          the answers are distributed, and the time of the most recent check-in
          rounded to about 15 minutes. The database does not allow anyone&apos;s
          browser to read the raw row, including who submitted it. Public copy
          looks like &quot;Based on 14 check-ins,&quot; not a name.
        </p>
        <p>
          Check-ins describe the space. We do not ask about diagnoses,
          disabilities, health, or any other fact about you as a person.
        </p>
      </>
    ),
  },
  {
    id: "preferences",
    title: "Display settings and My needs",
    body: (
      <>
        <p>
          Display choices you make while signed out, such as theme, contrast,
          text size, reduced motion, or whether you prefer the map or the list,
          stay in your browser&apos;s local storage. They are not sent to us
          with a check-in. Clearing site data for this site removes them.
        </p>
        <p>
          If you save settings on your account, we store them with that account
          so they can follow you between devices. A &quot;My needs&quot; profile,
          if you set one, is a list of space preferences, such as quiet, dim,
          step-free, or an all-gender restroom. It only sets your default
          filters and ranking. It is stored like any other setting. It is not a
          diagnosis, and it is never shown on a public page or tied to your
          check-ins in anything other people can see.
        </p>
      </>
    ),
  },
  {
    id: "not-collected",
    title: "Information we do not collect",
    body: (
      <>
        <ul>
          <li>Your password</li>
          <li>Free-text opinions, messages, or reviews attached to a check-in</li>
          <li>Diagnoses, disabilities, or health information</li>
          <li>
            Audio. An optional noise reading during a check-in is not part of
            the service today. If we add one, it is computed on your device, only
            a relative level is sent, and no recording is uploaded
          </li>
          <li>
            Photos of you. User photos of spaces are not part of the service
            today. If we add them, they would require a moderation plan, and
            they would describe a place
          </li>
          <li>
            Who booked a library room. When we show availability, it is whether
            a room or seat looks free. Booking happens on the library&apos;s own
            LibCal page, under your University account. We do not receive or
            store the booking, or who made it
          </li>
          <li>Device location</li>
          <li>Payment information. The service is free</li>
        </ul>
        <p>
          We do not sell personal information, and we do not use it for
          advertising. We do not take crowd levels from Google Popular Times or
          by scraping Google Maps.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    body: (
      <ul>
        <li>To show the map, official space details, and check-in totals</li>
        <li>To accept a check-in from a @umich.edu account</li>
        <li>
          To limit how often one account can check in to a space, and to
          investigate abuse
        </li>
        <li>To remember account preferences you choose to save</li>
        <li>To operate and protect the service</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who else processes information",
    body: (
      <>
        <p>
          We do not send your check-ins, your account, or a needs profile to the
          map, occupancy, or booking services below. Those services describe
          places, not you.
        </p>
        <ul>
          <li>
            <LegalLink href="https://supabase.com/privacy">Supabase</LegalLink>{" "}
            stores accounts, check-ins, and files such as floor-plan images.
            Database rules are what stop other users from reading your raw
            check-ins.
          </li>
          <li>
            <LegalLink href="https://vercel.com/legal/privacy-notice">
              Vercel
            </LegalLink>{" "}
            hosts the website and receives connection logs for that hosting.
          </li>
          <li>
            <LegalLink href="https://policies.google.com/privacy">
              Google
            </LegalLink>{" "}
            handles sign-in and sends us your name and email.
          </li>
          <li>
            OpenStreetMap tile delivery receives your browser&apos;s request for
            map images when you open the map. Map data is ©{" "}
            <LegalLink href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </LegalLink>
            .
          </li>
          <li>
            Waitz, where a building has a live occupancy feed, provides a
            crowd-density reading for that place. We request it from our
            server. The reading is about the building, not about you.
          </li>
          <li>
            University of Michigan Library systems, including LibCal
            (Springshare), if we show whether a room is free. We request
            availability from our server and cache it for at least a few
            minutes. If you follow a Book link, you leave Soothe Spaces and
            sign in on the library&apos;s site.
          </li>
        </ul>
        <p>
          Official study-space details come from the{" "}
          <LegalLink href="https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/">
            U-M Library Find Study Space
          </LegalLink>{" "}
          pages, and floor plans from{" "}
          <LegalLink href="https://mprint.umich.edu/">MPrint</LegalLink>. Those
          are descriptions of campus spaces, not information about you.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>
          We keep your account until you ask us to delete it, or until we close
          it for abuse of the service.
        </p>
        <p>
          We keep check-in rows so the totals stay accurate and so rate limits
          can work. If you ask us to delete your account, we delete the account
          and the check-in rows tied to it. Totals on the site are computed from
          the rows we still have, so those contributions drop out. There is no
          public copy of your name next to a check-in to retract, because that
          copy is never created.
        </p>
        <p>
          Display settings in local storage stay on your device until you clear
          them. We cannot delete those for you.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <ul>
        <li>Browse and read totals without an account.</li>
        <li>Skip checking in. Sign-in is only required to contribute.</li>
        <li>
          Clear this site&apos;s local storage in your browser to remove display
          settings kept on the device.
        </li>
        <li>
          Ask us to delete your account and the check-ins tied to it. Use the
          contact below, from the @umich.edu address on the account.
        </li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Soothe Spaces is for University of Michigan students and other people
        looking for campus study spaces. It is not directed at children under
        13, and we do not knowingly collect their personal information.
        Check-ins require a @umich.edu account.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        If this policy changes, we will update the date at the top of this
        page. The previous version stops applying when the new date is posted.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <LegalContact />,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      intro="What we collect, what other people can see, and how to ask us to delete it."
      sections={SECTIONS}
      current="privacy"
    />
  );
}
