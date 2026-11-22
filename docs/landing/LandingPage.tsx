/**
 * The landing page, in any language: the data-sheet layout,
 * with the app's colour tokens and the site's Overpass type. The Spectrum colours
 * appear only as the four-colour rule at the top and the square before each feature's heading.
 *
 * A server component rendered at build time: it reads the dictionary, the release facts and the
 * localized screenshots from disk. The Download button, the theme switch, the language menu, the
 * carousel and the picture viewer are the only client code. Every picture is a plain link to its
 * file, which the viewer opens over the page (R5).
 */
import Link from "next/link";
import { findLocalizedImage } from "../page-components/images";
import { DEFAULT_LOCALE, LOCALES } from "../i18n/locales.mjs";
import DownloadButton from "./DownloadButton";
import ImageViewer from "./ImageViewer";
import { FEATURES, HERO_SLIDES, SHOWN_FEATURES, type Feature } from "./features";
import HeroCarousel from "./HeroCarousel";
import { docsHref, landingHref, landingTranslator } from "./i18n";
import { readSiteInfo, versionAtMost } from "./site-info";
import BookCard from "./BookCard";
import { SiteFooter, SiteHeader } from "./SiteChrome";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The corner mark on a picture that opens full size */
const EXPAND = (
  <span className="lp-zoom-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);



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
      <SiteHeader lang={lang} />

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
            {/* --- The book, promoted like the download; its bottom is the carousel's (landing.css) */}
            <BookCard lang={lang} />
          </div>
          <div className="lp-top-media">
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
          </div>
        </section>

        {/* --- The facts under the first screen, in two groups under the sheet's 2px rule: "Get it" under
            --- the headline, "Write in" under the carousel. The version is set in the mono face. */}
        <section className="lp-glance" aria-labelledby="lp-glance-title">
          <h2 id="lp-glance-title" className="lp-sr-only">
            {t("glance.title")}
          </h2>
          <div>
            <h3>{t("glance.getIt")}</h3>
            <p>
              {(() => {
                const [before, after = ""] = t("glance.getItText", { version: "\u0000" }).split("\u0000");
                return (
                  <>
                    {before}
                    <span className="lp-mono">{site.latestRelease}</span>
                    {after}
                  </>
                );
              })()}
            </p>
          </div>
          <div>
            <h3>{t("glance.writeIn")}</h3>
            <p>{t("glance.writeInText")}</p>
          </div>
        </section>

        <section className="lp-sec lp-two lp-band">
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

        <section className="lp-sec lp-features lp-band">
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

      <SiteFooter lang={lang} />

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
