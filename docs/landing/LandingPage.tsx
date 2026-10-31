/**
 * The landing page, in any language: the data-sheet layout of .plans/DOCS_SITE_REDESIGN_PLAN.md
 * (R3), with the app's colour tokens and the site's Overpass type (R1, R2). The Spectrum colours
 * appear only as the four-colour rule at the top and the square before each feature's heading.
 *
 * A server component rendered at build time: it reads the dictionary, the release facts and the
 * localized screenshots from disk. The Download button, the theme switch, the language menu, the
 * carousel and the picture viewer are the only client code. Every picture is a plain link to its
 * file, which the viewer opens over the page (R5).
 */
import Link from "next/link";
import { findLocalizedImage } from "../page-components/images";
import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES } from "../i18n/locales.mjs";
import DownloadButton from "./DownloadButton";
import ImageViewer from "./ImageViewer";
import LanguageSelect from "./LanguageSelect";
import ThemeToggle from "./ThemeToggle";
import { FEATURES, HERO_SLIDES, SHOWN_FEATURES, type Feature } from "./features";
import HeroCarousel from "./HeroCarousel";
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

/** The corner mark on a picture that opens full size */
const EXPAND = (
  <span className="lp-zoom-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/** The header's links to the documentation areas: their text key and area */
const NAV = [
  ["nav.getStarted", "get-started"],
  ["nav.guides", "guides"],
  ["nav.reference", "reference"],
  ["nav.underTheHood", "under-the-hood"],
  ["nav.library", "library"]
] as const;

/** The steps of the "Write, build, run, debug" table */
const LOOP = ["write", "build", "run", "debug"] as const;

/** The rows of "Also included" (the first two keep their keys from the old strip of cards) */
const ALSO = ["strip.recording", "strip.scripting", "also.testing", "also.sdCard", "also.editors"] as const;

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
  const slides = HERO_SLIDES.map((s) => ({
    src: imageUrl(s.image, lang),
    ...(s.video ? { video: `${basePath}/images/${s.video}` } : {}),
    alt: t(s.caption),
    caption: t(s.caption),
    width: s.width,
    height: s.height
  }));
  const languages: [string, string, string][] = LOCALES.map((id: string) => [
    id,
    (LOCALE_NAMES as Record<string, string>)[id] ?? id,
    `${basePath}${landingHref(id)}`
  ]);
  // --- A machine appears once the latest release has it, as the features do (R6)
  const machines: [string, string][] = (
    [
      ["ZX Spectrum", t("machines.spectrum"), "0.1.0"],
      ["ZX Spectrum Next", "", "0.1.0"],
      ["ZX80, ZX81", "", "0.1.0"],
      [t("machines.clonesLabel"), t("machines.clones"), "0.1.0"],
      ["Cambridge Z88", "", "0.1.0"],
      ["HT-1080Z", "", "0.65.0"],
      ["Videoton TVC", "64K, 64K+", "0.66.0"],
      ["Enterprise", "64, 128", "0.67.0"]
    ] as [string, string, string][]
  )
    .filter(([, , since]) => versionAtMost(since, site.latestRelease))
    .map(([name, models]) => [name, models]);

  return (
    <div className="lp">
      <a className="lp-skip" href="#main">
        {t("nav.skip")}
      </a>
      <div className="lp-rule" aria-hidden="true" />
      <header className="lp-header">
        <div className="lp-header-in">
          <Link className="lp-brand" href={landingHref(lang)}>
            {LOGO}
            <span>Klive IDE</span>
          </Link>
          <nav className="lp-nav" aria-label="Klive">
            {NAV.map(([key, area]) => (
              <Link key={area} href={docsHref(lang, area)}>
                {t(key)}
              </Link>
            ))}
          </nav>
          <div className="lp-tools">
            <LanguageSelect current={lang} label={t("nav.language")} languages={languages} />
            <ThemeToggle label={t("nav.theme")} />
            {/* --- Where the links do not fit (below 900px) they move into this menu, with GitHub.
                --- A native disclosure: it opens and its links work without script. */}
            <details className="lp-menu">
              <summary className="lp-icon-button" aria-label={t("nav.menu")} title={t("nav.menu")}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </summary>
              <nav className="lp-menu-list" aria-label={t("nav.menu")}>
                {NAV.map(([key, area]) => (
                  <Link key={area} href={docsHref(lang, area)}>
                    {t(key)}
                  </Link>
                ))}
                <a href={GITHUB}>{t("nav.github")}</a>
              </nav>
            </details>
            <a className="lp-icon-button lp-github" href={GITHUB} aria-label={t("nav.github")} title={t("nav.github")}>
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

      <main id="main" className="lp-main">
        <section className="lp-top">
          <div className="lp-top-copy">
            <h1>{t("hero.title", { next: t("hero.next") })}</h1>
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
            </p>
          </div>
          <div className="lp-glance">
            <h2>{t("glance.title")}</h2>
            <table>
              <tbody>
                {site.latestRelease !== "0.0.0" && (
                  <tr>
                    <th scope="row">{t("glance.version")}</th>
                    <td>
                      <span className="lp-mono">{site.latestRelease}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">{t("glance.runsOn")}</th>
                  <td>macOS, Windows, Linux</td>
                </tr>
                <tr>
                  <th scope="row">{t("glance.licence")}</th>
                  <td>{t("glance.licenceValue")}</td>
                </tr>
                <tr>
                  <th scope="row">{t("glance.languages")}</th>
                  <td>{t("glance.languagesValue")}</td>
                </tr>
                <tr>
                  <th scope="row">{t("glance.worksWith")}</th>
                  <td>sjasmplus, Boriel BASIC, z88dk, PASTA/80</td>
                </tr>
                <tr>
                  <th scope="row">{t("glance.interface")}</th>
                  <td>{t("glance.interfaceValue")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="lp-carousel-band">
          <HeroCarousel
            slides={slides}
            label={t("hero.carousel.label")}
            previousLabel={t("hero.carousel.previous")}
            nextLabel={t("hero.carousel.next")}
            slideLabel={t("hero.carousel.slide")}
            pauseLabel={t("hero.carousel.pause")}
            playLabel={t("hero.carousel.play")}
            openLabel={t("viewer.open")}
          />
        </section>

        <section className="lp-sec lp-two">
          <div>
            <h2>{t("machines.title")}</h2>
            <table>
              <tbody>
                {machines.map(([name, models]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td className="lp-muted">{models}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2>{t("also.title")}</h2>
            <ul className="lp-rows">
              {ALSO.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec">
          <h2>{t("loop.title")}</h2>
          <table className="lp-loop">
            <thead>
              <tr>
                {LOOP.map((step) => (
                  <th key={step} scope="col">
                    {t(`loop.${step}.label`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {LOOP.map((step) => (
                  <td key={step}>
                    <b>{t(`loop.${step}.title`)}</b>
                    <span>{t(`loop.${step}.text`)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lp-sec lp-features">
          <h2>{t("features.title")}</h2>
          {features.map((f, i) => {
            const title = t(`feature.${f.id}.title`);
            const src = imageUrl(f.image, lang);
            return (
              <article key={f.id} id={f.id} className="lp-feature">
                <div className="lp-feature-copy">
                  <h3>
                    <span className={`lp-square lp-square-${(i % 5) + 1}`} aria-hidden="true" />
                    <Link href={docsHref(lang, f.more.area, f.more.rest)}>{title}</Link>
                  </h3>
                  <p>{t(`feature.${f.id}.text`)}</p>
                  <ul>
                    {[1, 2, 3].map((n) => (
                      <li key={n}>{t(`feature.${f.id}.point${n}`)}</li>
                    ))}
                  </ul>
                </div>
                <figure className="lp-feature-media">
                  <a
                    className="lp-zoom"
                    href={src}
                    data-viewer="features"
                    data-caption={title}
                    aria-label={t("viewer.open", { title })}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                    {EXPAND}
                  </a>
                </figure>
              </article>
            );
          })}
        </section>

        {/* --- The page ends on its job, the download (Hallmark rule 85), not on a slogan */}
        <section className="lp-end">
          <div>
            <h2>{t("cta.title")}</h2>
            <p>{t("cta.text")}</p>
          </div>
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
        </section>
      </main>

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

      <ImageViewer label={t("viewer.label")} closeLabel={t("viewer.close")} countLabel={t("viewer.count")} />
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
