/**
 * The header's menu button, on the landing page and in the docs navbar: where the area links do not
 * fit in the row, they move into this menu with GitHub (app/site-header.css; each header shows it
 * below its own width). A native disclosure: it opens and its links work without script.
 */
import Link from "next/link";
import { docsHref, landingTranslator } from "../landing/i18n";
import { GITHUB_URL } from "./SiteIcons";

/** The header's links to the documentation areas: their text key and area */
export const SITE_NAV = [
  ["nav.getStarted", "get-started"],
  ["nav.guides", "guides"],
  ["nav.reference", "reference"],
  ["nav.underTheHood", "under-the-hood"],
  ["nav.library", "library"]
] as const;

export default function SiteMenu({ lang }: Readonly<{ lang: string }>) {
  const t = landingTranslator(lang);
  return (
    <details className="site-menu">
      <summary className="site-icon-button" aria-label={t("nav.menu")} title={t("nav.menu")}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <nav className="site-menu-list" aria-label={t("nav.menu")}>
        {SITE_NAV.map(([key, area]) => (
          <Link key={area} href={docsHref(lang, area)}>
            {t(key)}
          </Link>
        ))}
        <a href={GITHUB_URL}>{t("nav.github")}</a>
      </nav>
    </details>
  );
}
