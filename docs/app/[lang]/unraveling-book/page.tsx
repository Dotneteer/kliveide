/**
 * /<lang>/unraveling-book/: the book's page in that language. English's is at "/unraveling-book/" (the
 * address the book prints), so /en/unraveling-book/ forwards there with a meta refresh, as /en/ does
 * for the landing page.
 */
import BookPage, { bookMetadata } from "../../../landing/BookPage";
import { bookHref } from "../../../landing/book";
import { themeBootScript } from "../../../landing/ThemeToggle";
import "../../site-header.css";
import "../../../landing/landing.css";
import "../../../landing/book.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type PageProps = Readonly<{ params: Promise<{ lang: string }> }>;

export async function generateMetadata({ params }: PageProps) {
  const { lang } = await params;
  return lang === "en" ? { robots: { index: false } } : bookMetadata(lang);
}

export default async function LangBook({ params }: PageProps) {
  const { lang } = await params;
  if (lang === "en") {
    const target = `${basePath}${bookHref("en")}`;
    return (
      <>
        <meta httpEquiv="refresh" content={`0; url=${target}`} />
        <link rel="canonical" href={target} />
        <p data-pagefind-ignore="all">
          <a href={target}>Unraveling the ZX Spectrum Next</a>
        </p>
      </>
    );
  }
  return (
    <div className="lp-body" data-pagefind-ignore="all">
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <BookPage lang={lang} />
    </div>
  );
}
