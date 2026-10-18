/**
 * /<lang>/: that language's landing page. English's is at "/", so /en/ forwards there with a
 * meta refresh (a static export cannot redirect, and next/navigation's redirect() needs
 * JavaScript to move).
 */
import LandingPage, { landingMetadata } from "../../landing/LandingPage";
import LanguageSuggestion from "../../landing/LanguageSuggestion";
import { themeBootScript } from "../../landing/ThemeToggle";
import "../../landing/landing.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type PageProps = Readonly<{ params: Promise<{ lang: string }> }>;

export async function generateMetadata({ params }: PageProps) {
  const { lang } = await params;
  return lang === "en" ? { robots: { index: false } } : landingMetadata(lang);
}

export default async function LangHome({ params }: PageProps) {
  const { lang } = await params;
  if (lang === "en") {
    const target = `${basePath}/`;
    return (
      <>
        <meta httpEquiv="refresh" content={`0; url=${target}`} />
        <link rel="canonical" href={target} />
        <p data-pagefind-ignore="all">
          <a href={target}>Klive IDE</a>
        </p>
      </>
    );
  }
  return (
    <div className="lp-body" data-pagefind-ignore="all">
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <LanguageSuggestion current={lang} />
      <LandingPage lang={lang} />
    </div>
  );
}
