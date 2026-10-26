/**
 * The Cambridge Z88 User Guide's pages: `content/<lang>/z88-user-guide.mdx` and everything under
 * `content/<lang>/z88-user-guide/`, rendered like any docs page (`../../../docs-page.tsx`).
 * The catch-all docs route leaves these routes to this one.
 */
import { generateStaticParamsFor } from "nextra/pages";
import { DocsPage, docsPageMetadata, type DocsPageParams } from "../../../docs-page";

const AREA = "z88-user-guide";
const allParams = generateStaticParamsFor("mdxPath", "lang");

type Params = { lang: string; mdxPath?: string[] };

export async function generateStaticParams() {
  const params = (await allParams()) as DocsPageParams[];
  return params
    .filter((p) => p.mdxPath[0] === AREA)
    .map((p) => ({ lang: p.lang, mdxPath: p.mdxPath.slice(1) }));
}

/** The content path of a route under the area */
function contentParams({ lang, mdxPath = [] }: Params): DocsPageParams {
  return { lang, mdxPath: [AREA, ...mdxPath] };
}

type PageProps = Readonly<{ params: Promise<Params> }>;

export async function generateMetadata(props: PageProps) {
  return docsPageMetadata(contentParams(await props.params));
}

export default async function Page(props: PageProps) {
  return <DocsPage params={contentParams(await props.params)} />;
}
