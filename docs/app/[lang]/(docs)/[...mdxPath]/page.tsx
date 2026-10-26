/**
 * Catch-all route that renders every listed MDX page under `content/<lang>/`; the rendering is
 * `../../docs-page.tsx`.
 *
 * This is Nextra 4's "content directory convention", with i18n: `generateStaticParamsFor` emits
 * one page per locale and route, and `importPage(path, lang)` loads `content/<lang>/<path>`.
 * The unlisted areas with a sidebar of their own have their own routes in `../../(unlisted)/`,
 * so they are left out here.
 *
 * Adapted from the official Nextra example:
 * https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx
 */
import { generateStaticParamsFor } from "nextra/pages";
import { DocsPage, docsPageMetadata, type DocsPageParams } from "../../docs-page";
import { UNLISTED_WITH_SIDEBAR } from "../../docs-shell";

const allParams = generateStaticParamsFor("mdxPath", "lang");

export async function generateStaticParams() {
  const params = (await allParams()) as DocsPageParams[];
  return params.filter((p) => !UNLISTED_WITH_SIDEBAR.includes(p.mdxPath[0]));
}

type PageProps = Readonly<{ params: Promise<DocsPageParams> }>;

export async function generateMetadata(props: PageProps) {
  return docsPageMetadata(await props.params);
}

export default async function Page(props: PageProps) {
  return <DocsPage params={await props.params} />;
}
