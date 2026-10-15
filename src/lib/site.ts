// Routes and copy shared by the header, footer and landing page.

export const ROUTES = {
  home: "/",
  map: "/map",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  signIn: "/login",
  accountPreferences: "/settings",
} as const;

export const NAV_LINKS = [
  { href: ROUTES.map, label: "Map" },
  { href: ROUTES.help, label: "Help" },
  { href: ROUTES.accountPreferences, label: "Preferences" },
] as const;

export type HelpTopic = {
  id: string;
  title: string;
  questions: { question: string; answer: string }[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "finding-spaces",
    title: "Finding a space",
    questions: [
      {
        question: "What is Soothe Spaces?",
        answer:
          "A campus map for finding study spaces by how they feel: how loud they are, the lighting, how busy they get, and whether you can get in step-free.",
      },
      {
        question: "Do I need an account?",
        answer:
          "No. Anyone can browse the map and read check-in totals. You only need to sign in to check in, or to save preferences to your account.",
      },
      {
        question: "Where does the information come from?",
        answer:
          "Official features, such as natural light or whiteboards, come from the U-M Library. Noise, light and busyness come from students' check-ins. When nothing recent has been reported, a space says so instead of guessing.",
      },
    ],
  },
  {
    id: "check-ins",
    title: "Check-ins",
    questions: [
      {
        question: "What is a check-in?",
        answer:
          "A quick note about what a space is like right now: noise, light, how busy it is, and how easy it is to focus. There's no free text and no star rating.",
      },
      {
        question: "Can anyone see my check-ins?",
        answer:
          "No. Your individual check-ins are never shown to anyone. Other people only see totals, like \"Based on 14 check-ins\".",
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts and sign-in",
    questions: [
      {
        question: "Who can sign up?",
        answer:
          "Anyone with a @umich.edu Google account. There's no password to remember.",
      },
      {
        question: "Where are my account preferences?",
        answer:
          "Open Preferences in the header on any page. After you sign in, you can also open Account preferences from your profile menu.",
      },
    ],
  },
  {
    id: "accessibility",
    title: "Accessibility and display",
    questions: [
      {
        question: "Can I change contrast, text size or motion?",
        answer:
          "Yes. Open Preferences to set the theme, contrast, text size, and motion. Soothe Spaces follows your device until you choose otherwise. Without an account, those choices stay on this device. Sign in with your @umich.edu account to save them to your account.",
      },
    ],
  },
];

export type Footnote = { id: string; text: string; href: string; source: string };

// Numbered by position. Pages cite them with <FootnoteRef id="..." />.
export const FOOTNOTES: Footnote[] = [
  {
    id: "library-spaces",
    text: "Official study space details and features:",
    source: "U-M Library, Find Study Space",
    href: "https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/",
  },
  {
    id: "floor-plans",
    text: "Floor plans:",
    source: "MPrint, University of Michigan",
    href: "https://mprint.umich.edu/",
  },
  {
    id: "map-data",
    text: "Map data:",
    source: "© OpenStreetMap contributors",
    href: "https://www.openstreetmap.org/copyright",
  },
];
