/**
 * The header and footer of the pages that are not documentation: the landing page in every language
 * and the book's page (/unraveling-book/). One header on every page (docs/design.md); the docs' own
 * navbar is Nextra's, restyled to match.
 */
import Link from "next/link";
import { LOCALE_NAMES, LOCALES } from "../i18n/locales.mjs";
import LanguageSelect from "./LanguageSelect";
import ThemeToggle from "./ThemeToggle";
import { docsHref, landingHref, landingTranslator } from "./i18n";
import { GITHUB_ICON, GITHUB_URL as GITHUB } from "../page-components/SiteIcons";
import SiteMenu, { SITE_NAV } from "../page-components/SiteMenu";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const LOGO = (
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <rect width="200" height="200" fill="#000" />
    <path d="M200 149v-20l-70 70h20" fill="#0ff" />
    <path d="M200 129v-20l-90 90h20" fill="#0f0" />
    <path d="M200 109V89L90 199h20" fill="#ff0" />
    <path d="M200 89V69L70 199h20" fill="#f00" />
    <path d="M0 0h200v8H0zM0 192h200v8H0zM0 0h8v200H0zM192 0h8v200h-8z" fill="#00B4CC" />
    <path d="M40 40h20v120H40zM60 80h40v20H60zM100 100h20v20h-20zM120 120h20v20h-20zM140 140h20v20h-20zM100 60h20v20h-20zM120 40h20v20h-20z" fill="#00B4CC" />
  </svg>
);

/**
 * The skip link, the four-colour rule and the sticky header row. `pageHref` gives this page's address
 * in another language, so the language menu stays on the same page (the landing page's by default).
 */
export function SiteHeader({
  lang,
  pageHref = landingHref
}: Readonly<{ lang: string; pageHref?: (lang: string) => string }>) {
  const t = landingTranslator(lang);
  const languages: [string, string, string][] = LOCALES.map((id: string) => [
    id,
    (LOCALE_NAMES as Record<string, string>)[id] ?? id,
    `${basePath}${pageHref(id)}`
  ]);
  return (
    <>
      <a className="lp-skip" href="#main">
        {t("nav.skip")}
      </a>
      <div className="site-rule" aria-hidden="true" />
      <header className="lp-header">
        <div className="lp-header-in">
          <Link className="lp-brand" href={landingHref(lang)}>
            {LOGO}
            <span>Klive IDE</span>
          </Link>
          <nav className="lp-nav" aria-label="Klive">
            {SITE_NAV.map(([key, area]) => (
              <Link key={area} href={docsHref(lang, area)}>
                {t(key)}
              </Link>
            ))}
          </nav>
          <div className="lp-tools">
            <LanguageSelect current={lang} label={t("nav.language")} languages={languages} />
            <ThemeToggle label={t("nav.theme")} />
            {/* --- Below 900px the links and GitHub move into this menu (landing.css) */}
            <SiteMenu lang={lang} />
            <a className="site-icon-button lp-github" href={GITHUB} aria-label={t("nav.github")} title={t("nav.github")}>
              {GITHUB_ICON}
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ lang }: Readonly<{ lang: string }>) {
  const t = landingTranslator(lang);
  return (
    <footer className="lp-footer">
      <div className="lp-footer-in">
        <span>{t("footer.license")}</span>
        <nav aria-label={t("footer.docs")}>
          <Link href={docsHref(lang, "get-started")}>{t("footer.docs")}</Link>
          <Link href={docsHref(lang, "reference", "whats-new/")}>{t("footer.changelog")}</Link>
          <a href={`${GITHUB}/issues`}>{t("footer.issues")}</a>
          <a href={`${GITHUB}/blob/master/src/common/i18n/locales/README.md`}>{t("footer.translate")}</a>
        </nav>
      </div>
    </footer>
  );
}
