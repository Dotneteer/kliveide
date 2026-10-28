/**
 * Catch-all route that renders every listed MDX page under `content/<lang>/`; the rendering is
 * `../../docs-page.tsx`.
 *
 * This is Nextra 4's "content directory convention", with i18n: `generateStaticParamsFor` emits
 * one page per locale and route, and `importPage(path, lang)` loads `content/<lang>/<path>`.
 *
 * Adapted from the official Nextra example:
 * https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx
 */
import { generateStaticParamsFor } from "nextra/pages";
import { DocsPage, docsPageMetadata, type DocsPageParams } from "../../docs-page";

export const generateStaticParams = generateStaticParamsFor("mdxPath", "lang");

type PageProps = Readonly<{ params: Promise<DocsPageParams> }>;

export async function generateMetadata(props: PageProps) {
  return docsPageMetadata(await props.params);
}

export default async function Page(props: PageProps) {
  return <DocsPage params={await props.params} />;
}
