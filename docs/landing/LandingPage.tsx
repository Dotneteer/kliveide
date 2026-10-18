/**
 * The landing page, in any language (decision D8 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md):
 * the app's tokens and type everywhere (direction A), one loud Spectrum moment - the stripe band
 * behind the hero and the colour blocks (direction B) - and plain, translatable text.
 *
 * A server component rendered at build time: it reads the dictionary, the release facts and the
 * localized screenshots from disk. The Download button, the theme switch and the language menu
 * are the only client code.
 */
import Link from "next/link";
import { findLocalizedImage } from "../page-components/images";
import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES } from "../i18n/locales.mjs";
import DownloadButton from "./DownloadButton";
import LanguageSelect from "./LanguageSelect";
import ThemeToggle from "./ThemeToggle";
import { FEATURES, SHOWN_FEATURES, type Feature } from "./features";
import { docsHref, landingHref, landingTranslator } from "./i18n";
import { readSiteInfo, versionAtMost } from "./site-info";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const GITHUB = "https://github.com/Dotneteer/kliveide";

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

function imageUrl(image: Feature["image"], lang: string): string {
  if ("path" in image) return `${basePath}/images/${image.path}`;
  const file = findLocalizedImage(image.localized, lang);
  if (!file) throw new Error(`Landing page: no image ${image.localized}`);
  return `${basePath}/images/${file}`;
}

export default function LandingPage({ lang }: Readonly<{ lang: string }>) {
  const t = landingTranslator(lang);
  const site = readSiteInfo();
  const features = FEATURES.filter((f) => versionAtMost(f.since, site.latestRelease)).slice(0, SHOWN_FEATURES);
  const heroShot = imageUrl({ localized: "get-started/debug-paused.webp" }, lang);
  const languages: [string, string, string][] = LOCALES.map((id: string) => [
    id,
    (LOCALE_NAMES as Record<string, string>)[id] ?? id,
    `${basePath}${landingHref(id)}`
  ]);
  const [before, after] = t("hero.title").split("{next}");

  return (
    <div className="lp">
      <a className="lp-skip" href="#main">
        {t("nav.skip")}
      </a>
      <header className="lp-header">
        <div className="lp-header-in">
          <Link className="lp-brand" href={landingHref(lang)}>
            {LOGO}
            <span>Klive IDE</span>
          </Link>
          <nav className="lp-nav" aria-label="Klive">
            <Link href={docsHref(lang, "get-started")}>{t("nav.getStarted")}</Link>
            <Link href={docsHref(lang, "guides")}>{t("nav.guides")}</Link>
            <Link href={docsHref(lang, "reference")}>{t("nav.reference")}</Link>
          </nav>
          <div className="lp-tools">
            <LanguageSelect current={lang} label={t("nav.language")} languages={languages} />
            <ThemeToggle label={t("nav.theme")} />
            <a className="lp-icon-button" href={GITHUB} aria-label={t("nav.github")} title={t("nav.github")}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"
                />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero">
          <div className="lp-hero-in">
            <div className="lp-hero-copy">
              {site.latestRelease !== "0.0.0" && (
                <span className="lp-badge">{t("hero.badge", { version: site.latestRelease })}</span>
              )}
              <h1>
                {before}
                <em>{t("hero.next")}</em>
                {after}
              </h1>
              <p className="lp-lead">{t("hero.lead")}</p>
              <div className="lp-actions">
                <DownloadButton
                  downloads={site.downloads}
                  releasesPage={site.releasesPage}
                  labelForOs={t("hero.download")}
                  labelGeneric={t("hero.downloadGeneric")}
                />
                <Link className="lp-button" href={docsHref(lang, "get-started")}>
                  {t("hero.getStarted")}
                </Link>
              </div>
              <p className="lp-fine">
                <a href={site.releasesPage}>{t("hero.otherPlatforms")}</a>
                <span aria-hidden="true"> · </span>
                {t("hero.free")}
              </p>
            </div>
            <div className="lp-hero-shot">
              <img src={heroShot} alt={t("hero.shotAlt")} width={1800} height={1153} />
            </div>
          </div>
        </section>

        <section className="lp-machines" aria-label={t("machines.title")}>
          <div className="lp-machines-in">
            <span>
              <b>ZX Spectrum</b> {t("machines.spectrum")}
            </span>
            <span>
              <b>ZX Spectrum Next</b>
            </span>
            <span>
              <b>ZX80 · ZX81</b>
            </span>
            <span>
              <b>{t("machines.clones")}</b>
            </span>
            <span>
              <b>Cambridge Z88</b>
            </span>
          </div>
        </section>

        <section className="lp-blocks" aria-label={t("features.title")}>
          {features.slice(0, 4).map((f) => (
            <a key={f.id} className="lp-block" href={`#${f.id}`}>
              <span className="lp-block-tag">{t(`feature.${f.id}.tag`)}</span>
              <h2>{t(`feature.${f.id}.title`)}</h2>
              <p>{t(`feature.${f.id}.short`)}</p>
            </a>
          ))}
        </section>

        <section className="lp-loop">
          <div className="lp-loop-in">
            {(["write", "build", "run", "debug"] as const).map((step, i) => (
              <div key={step} className="lp-step">
                <span className="lp-step-label">
                  {String(i + 1).padStart(2, "0")} · {t(`loop.${step}.label`)}
                </span>
                <h3>{t(`loop.${step}.title`)}</h3>
                <p>{t(`loop.${step}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-features">
          <h2 className="lp-section-title">{t("features.title")}</h2>
          {features.map((f, i) => (
            <article key={f.id} id={f.id} className={`lp-feature${i % 2 ? " lp-feature-flip" : ""}`}>
              <div className="lp-feature-copy">
                <span className="lp-tag">{t(`feature.${f.id}.tag`)}</span>
                <h3>{t(`feature.${f.id}.title`)}</h3>
                <p>{t(`feature.${f.id}.text`)}</p>
                <ul>
                  {[1, 2, 3].map((n) => (
                    <li key={n}>{t(`feature.${f.id}.point${n}`)}</li>
                  ))}
                </ul>
                <Link className="lp-more" href={docsHref(lang, f.more.area, f.more.rest)}>
                  {t("feature.more")} →
                </Link>
              </div>
              <div className="lp-feature-media">
                <img src={imageUrl(f.image, lang)} alt="" loading="lazy" decoding="async" />
              </div>
            </article>
          ))}
        </section>

        <section className="lp-strip">
          <div className="lp-strip-in">
            {(["vhdl", "recording", "scripting", "languages", "open"] as const).map((k) => (
              <span key={k}>{t(`strip.${k}`)}</span>
            ))}
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-cta-in">
            <h2>{t("cta.title")}</h2>
            <p>{t("cta.text")}</p>
            <Link className="lp-button lp-button-primary" href={docsHref(lang, "get-started")}>
              {t("hero.getStarted")}
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-in">
          <span>{t("footer.license")}</span>
          <nav aria-label={t("footer.docs")}>
            <Link href={docsHref(lang, "get-started")}>{t("footer.docs")}</Link>
            <a href={`${GITHUB}/blob/master/CHANGELOG.md`}>{t("footer.changelog")}</a>
            <a href={`${GITHUB}/issues`}>{t("footer.issues")}</a>
            <a href={`${GITHUB}/blob/master/src/common/i18n/locales/README.md`}>{t("footer.translate")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Metadata for a language's landing page, with the other languages as alternates. */
export function landingMetadata(lang: string) {
  const t = landingTranslator(lang);
  const languages = Object.fromEntries(LOCALES.map((id: string) => [id, `${basePath}${landingHref(id)}`]));
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: `${basePath}${landingHref(lang)}`, languages: { ...languages, "x-default": `${basePath}/` } },
    openGraph: { title: t("meta.title"), description: t("meta.description"), locale: lang },
    icons: { icon: `${basePath}/images/klive-logo.svg` }
  };
}

export { DEFAULT_LOCALE };
