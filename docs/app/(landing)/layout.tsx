/**
 * Root layout for the landing page ("/").
 *
 * The site has two root layouts (Next.js route groups): this one, which is plain React,
 * and `app/(docs)/layout.tsx`, which wraps every documentation page in Nextra's <Layout>.
 * Navigating between the two is a full page load - that is how separate root layouts work.
 *
 * See .plans/LANDING_PAGE_PROTOTYPE_PLAN.md.
 */
import type { Metadata } from "next";
import "./landing.css";

export const metadata: Metadata = {
  title: "Klive IDE",
  description:
    "Klive IDE is a retro computer emulator and Integrated Development Environment running on Mac and Windows."
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      {/* Pagefind indexes documentation only; keep the landing page out of search. */}
      <body className="landing" data-pagefind-ignore="all">
        {children}
      </body>
    </html>
  );
}
