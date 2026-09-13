/**
 * Catch-all route that renders every MDX page under `content/`.
 *
 * This is Nextra 4's "content directory convention": the closest equivalent to the
 * Nextra 3 Pages Router layout we migrated from, and the reason `pages/` could
 * simply become `content/` without touching 88 MDX files.
 *
 * Adapted from the official Nextra example:
 * https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx
 */
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

type PageProps = Readonly<{ params: Promise<{ mdxPath: string[] }> }>;

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { default: MDXContent, toc, metadata, sourceCode } = await importPage(params.mdxPath);
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
