/**
 * The page of "Unraveling the ZX Spectrum Next", the book the landing page's card promotes, in every
 * language of the site: /unraveling-book/ in English (the address the book prints) and
 * /<lang>/unraveling-book/ in the others. It wears the landing page's header and footer
 * (SiteChrome.tsx, whose language menu stays on this page) and its sheet layout: the cover and the
 * downloads first, then the book in numbers, its parts and chapters, the examples and why it was
 * written.
 *
 * The page's texts are the landing catalog's `bookPage.*` (docs/i18n/landing/). The book itself is
 * English, so its title, subtitle, part and chapter titles and demo names stay English everywhere;
 * they come from docs/books/unraveling-next/book.json. The author's name is the catalog's
 * `book.author`, because languages order names differently (Hungarian: family name first).
 */
import type { ReactNode } from "react";
import { LOCALES } from "../i18n/locales.mjs";
import { BOOK_EXAMPLES, BOOK_PDF, COVER_RATIO, bookCover, bookHref, demoCount, examplesBytes, readBook } from "./book";
import { DOWNLOAD_ICON, FOLDER_ICON } from "./BookCard";
import ImageViewer from "./ImageViewer";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { landingTranslator, type Translate } from "./i18n";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** "6.6 MB", "75 KB", with the language's decimal mark */
function size(bytes: number | undefined, lang: string): string {
  if (bytes === undefined) return "";
  const mb = bytes >= 1024 * 1024;
  const value = mb ? bytes / 1024 / 1024 : Math.round(bytes / 1024);
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value)} ${mb ? "MB" : "KB"}`;
}

/** A chapter's short title: its heading before the colon */
function shortTitle(chapter: string): string {
  return chapter.split(": ")[0];
}

/** A catalog text with some placeholders replaced by elements (a file name in the mono face, ...) */
function rich(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    return name && name in parts ? <span key={i}>{parts[name]}</span> : piece;
  });
}

function Downloads({ t, pdf, zip }: Readonly<{ t: Translate; pdf: string; zip: string }>) {
  return (
    <div className="lp-actions">
      <a className="lp-button lp-button-primary" href={BOOK_PDF} download>
        {DOWNLOAD_ICON}
        {t("bookPage.downloadBook")} <span className="bk-size">PDF, {pdf}</span>
      </a>
      <a className="lp-button" href={BOOK_EXAMPLES} download>
        {FOLDER_ICON}
        {t("bookPage.downloadExamples")} <span className="bk-size">ZIP, {zip}</span>
      </a>
    </div>
  );
}

export default function BookPage({ lang }: Readonly<{ lang: string }>) {
  const t = landingTranslator(lang);
  const book = readBook();
  const pdf = size(book.pdfBytes, lang);
  const zip = size(examplesBytes(), lang);
  const chapters = book.parts.reduce((n, p) => n + p.chapters.length, 0);
  const demos = demoCount(book);
  const mono = (text: string) => <span className="lp-mono">{text}</span>;
  return (
    <div className="lp">
      <SiteHeader lang={lang} pageHref={bookHref} />

      <main id="main" className="lp-main">
        <section className="bk-hero">
          <a
            className="bk-cover"
            href={bookCover(1500)}
            data-viewer="book"
            data-caption={book.title}
            aria-label={t("viewer.open", { title: book.title })}
          >
            <img src={bookCover(720)} alt="" width={COVER_RATIO.width * 360} height={COVER_RATIO.height * 360} decoding="async" />
          </a>
          <div>
            <h1 lang="en">{book.title}</h1>
            <p className="bk-subtitle" lang="en">
              {book.subtitle}
            </p>
            <p className="bk-by">{t("bookPage.by", { author: t("book.author") })}</p>
            <p className="lp-lead">{t("bookPage.lead")}</p>
            <Downloads t={t} pdf={pdf} zip={zip} />
            <p className="lp-fine">
              {lang !== "en" && <>{t("bookPage.inEnglish")} </>}
              {rich(t("bookPage.free"), { folder: mono("examples"), run: <b>Run</b> })}
            </p>
          </div>
        </section>

        <section className="bk-facts" aria-label={t("bookPage.facts.label")}>
          <div>
            <b>{book.pages}</b>
            <span>{t("bookPage.facts.pages")}</span>
          </div>
          <div>
            <b>{t("bookPage.facts.parts", { count: String(book.parts.length) })}</b>
            <span>{t("bookPage.facts.chapters", { count: String(chapters) })}</span>
          </div>
          <div>
            <b>{t("bookPage.facts.demos", { count: String(demos) })}</b>
            <span>{rich(t("bookPage.facts.program"), { nex: mono(".nex") })}</span>
          </div>
          <div>
            <b>Klive IDE</b>
            <span>{t("bookPage.facts.project")}</span>
          </div>
        </section>

        <section className="lp-sec lp-band" aria-labelledby="bk-inside">
          <h2 id="bk-inside">{t("bookPage.inside.title")}</h2>
          <div className="bk-parts">
            {book.parts.map((part, i) => (
              <div key={part.title}>
                <h3 lang="en">
                  <span className={`lp-square lp-square-${i + 1}`} aria-hidden="true" />
                  {part.title}
                </h3>
                <p className="bk-part-count">
                  {t("bookPage.inside.part", { n: String(i + 1), count: String(part.chapters.length) })}
                </p>
                <ol lang="en">
                  {part.chapters.map((c) => (
                    <li key={c} title={c}>
                      {shortTitle(c)}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec bk-two">
          <div>
            <h2>{t("bookPage.examples.title")}</h2>
            <p>{rich(t("bookPage.examples.text"), { file: mono("book-demos.nex") })}</p>
            <ol className="bk-steps">
              <li>{t("bookPage.examples.step1")}</li>
              <li>{rich(t("bookPage.examples.step2"), { folder: mono("examples") })}</li>
              <li>{rich(t("bookPage.examples.step3"), { run: <b>Run</b> })}</li>
            </ol>
            <p>{rich(t("bookPage.examples.realNext"), { file: mono("book-demos.nex") })}</p>
            <Downloads t={t} pdf={pdf} zip={zip} />
          </div>
          <div>
            <h2>{t("bookPage.facts.demos", { count: String(demos) })}</h2>
            <ul className="bk-demos" lang="en">
              {book.parts.map((part) => (
                <li key={part.title}>
                  <b>{part.title}</b>
                  <span>{part.demos.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec lp-band">
          <h2>{t("bookPage.why.title")}</h2>
          <p className="bk-why">{t("bookPage.why.text", { author: t("book.author") })}</p>
        </section>

        <section className="lp-end">
          <div>
            <h2>{t("bookPage.end.title")}</h2>
            <p>{t("bookPage.end.text")}</p>
          </div>
          <Downloads t={t} pdf={pdf} zip={zip} />
        </section>
      </main>

      <SiteFooter lang={lang} />

      <ImageViewer label={t("viewer.label")} closeLabel={t("viewer.close")} countLabel={t("viewer.count")} />
    </div>
  );
}

/** The book page's metadata in a language, with the other languages as alternates */
export function bookMetadata(lang: string) {
  const t = landingTranslator(lang);
  const book = readBook();
  const description = t("bookPage.meta.description", { pages: String(book.pages), author: t("book.author") });
  const languages = Object.fromEntries(LOCALES.map((id: string) => [id, `${basePath}${bookHref(id)}`]));
  return {
    title: `${book.title} | Klive IDE`,
    description,
    alternates: {
      canonical: `${basePath}${bookHref(lang)}`,
      languages: { ...languages, "x-default": `${basePath}${bookHref("en")}` }
    },
    openGraph: { title: book.title, description, images: [bookCover(720)], locale: lang },
    icons: { icon: `${basePath}/images/klive-logo.svg` }
  };
}
