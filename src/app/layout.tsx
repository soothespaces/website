import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Inter 4 from rsms/inter, self-hosted: Google Fonts' copy drops the
// alternate glyphs we turn on in globals.css. Its optical-size axis gives
// headings the tighter display cut automatically.
const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Soothe Spaces", template: "%s · Soothe Spaces" },
  description: "Find quiet, accessible study spaces on campus.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only rounded-md bg-primary font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
