/**
 * /<lang>/ has no page of its own yet; it forwards to the language's Get Started.
 * Phase 4/5 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md puts the translated landing page here.
 *
 * A static export cannot answer with a redirect, and next/navigation's redirect() emits a
 * page that only moves once its JavaScript runs. A meta refresh works without it.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type PageProps = Readonly<{ params: Promise<{ lang: string }> }>;

export default async function LangHome({ params }: PageProps) {
  const { lang } = await params;
  const target = `${basePath}/${lang}/get-started/`;
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <link rel="canonical" href={target} />
      <p data-pagefind-ignore="all">
        <a href={target}>Get Started</a>
      </p>
    </>
  );
}
