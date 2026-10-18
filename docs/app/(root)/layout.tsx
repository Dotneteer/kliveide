/**
 * Root layout for "/", the English landing page. The other languages' landing pages render the
 * same component under `app/[lang]` (Phase 5 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md).
 *
 * No Nextra here: navigating to the docs is a full page load, as between any two root layouts.
 */
import { fontVariables } from "../fonts";
import { themeBootScript } from "../../landing/ThemeToggle";
import "../tokens.css";
import "../../landing/landing.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      {/* Pagefind indexes documentation only; keep the landing page out of search. */}
      <body className="lp-body" data-pagefind-ignore="all">
        {children}
      </body>
    </html>
  );
}
