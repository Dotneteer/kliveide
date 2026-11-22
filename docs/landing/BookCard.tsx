/**
 * The book's card in the landing page's first screen, under Klive's own Download: the cover (a link
 * to the book's page), one line about the book and its two downloads, the book's filled like Klive's.
 * The book is English in every language; its title is never translated, and it is the card's heading
 * alone, so the heading is one line in every language ("free" is in the sentence under it). The
 * heading links to the book's page, and so does "About the book", on a line of its own under the
 * sentence, so the sentence stays within two lines in every language (`book.text`, about 60 characters). The cover and "About the
 * book" lead to the book's page in the card's language.
 */
import Link from "next/link";
import { BOOK_EXAMPLES, BOOK_PDF, bookHref, COVER_RATIO, bookCover, demoCount, readBook } from "./book";
import { landingTranslator } from "./i18n";

export const DOWNLOAD_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FOLDER_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export default function BookCard({ lang }: Readonly<{ lang: string }>) {
  const t = landingTranslator(lang);
  const book = readBook();
  return (
    <aside className="lp-book-card" aria-labelledby="lp-book-card-title">
      <Link className="lp-book-cover" href={bookHref(lang)} aria-label={t("book.about")}>
        <img src={bookCover(240)} alt="" width={COVER_RATIO.width * 120} height={COVER_RATIO.height * 120} decoding="async" />
      </Link>
      <div>
        {/* --- The heading is the link to the book's page, as a feature's heading is (no "About the book") */}
        <b id="lp-book-card-title" lang="en">
          <Link href={bookHref(lang)}>{book.title}</Link>
        </b>
        <p>{t("book.text", { pages: String(book.pages), demos: String(demoCount(book)) })}</p>
        {/* --- Its own line, so the sentence above keeps to two lines in every language */}
        <p className="lp-book-about">
          <Link href={bookHref(lang)}>{t("book.about")}</Link>
        </p>
        <div className="lp-actions">
          <a className="lp-button lp-button-primary" href={BOOK_PDF} download>
            {DOWNLOAD_ICON}
            {t("book.pdf")}
          </a>
          <a className="lp-button" href={BOOK_EXAMPLES} download>
            {FOLDER_ICON}
            {t("book.examples")}
          </a>
        </div>
      </div>
    </aside>
  );
}
