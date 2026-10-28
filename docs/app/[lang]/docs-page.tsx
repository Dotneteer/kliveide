/**
 * Renders an MDX page under `content/<lang>/` for the catch-all route,
 * `(docs)/[...mdxPath]/page.tsx`.
 *
 * This is Nextra 4's "content directory convention", with i18n: `generateStaticParamsFor` emits
 * one page per locale and route, and `importPage(path, lang)` loads `content/<lang>/<path>`.
 *
 * Adapted from the official Nextra example:
 * https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { importPage } from "nextra/pages";
import { DEFAULT_LOCALE, LOCALES } from "../../i18n/locales.mjs";
import { uiTranslator } from "../../i18n/ui";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";
import Shot from "../../page-components/Shot";
import { replaceReleaseToken } from "../../remark-release-version.mjs";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const CONTENT = join(process.cwd(), "content");

export type DocsPageParams = { mdxPath: string[]; lang: string };

/** The MDX file of a route in a language, if it has one. */
function sourceFile(lang: string, mdxPath: string[]): string | undefined {
  const base = join(CONTENT, lang, ...mdxPath.map(decodeURIComponent));
  return [`${base}.mdx`, `${base}.md`, join(base, "index.mdx")].find((f) => existsSync(f));
}

/**
 * True when the English original changed after this translation was made: the hash recorded at
 * merge time (docs/i18n/sources/<lang>.json, scripts/docs-i18n.cjs) no longer matches.
 */
function isOutdated(lang: string, mdxPath: string[]): boolean {
  if (lang === DEFAULT_LOCALE) return false;
  const english = sourceFile(DEFAULT_LOCALE, mdxPath);
  const sources = join(process.cwd(), "i18n", "sources", `${lang}.json`);
  if (!english || !existsSync(sources)) return false;
  const key = english.slice(join(CONTENT, DEFAULT_LOCALE).length + 1).replace(/\.mdx?$/, "");
  const recorded = (JSON.parse(readFileSync(sources, "utf8")).pages ?? {})[key];
  const current = createHash("sha1").update(readFileSync(english, "utf8")).digest("hex").slice(0, 16);
  return recorded !== undefined && recorded !== current;
}

export async function docsPageMetadata(params: DocsPageParams) {
  const { metadata } = await importPage(params.mdxPath, params.lang);
  // --- Every language that has this page, so search engines can offer the right one
  const route = params.mdxPath.join("/");
  const languages = Object.fromEntries(
    LOCALES.filter((l: string) => sourceFile(l, params.mdxPath)).map((l: string) => [l, `${basePath}/${l}/${route}/`])
  );
  return { ...metadata, alternates: { languages } };
}

const Wrapper = getMDXComponents().wrapper;

export async function DocsPage({ params }: Readonly<{ params: DocsPageParams }>) {
  const { default: MDXContent, toc, metadata, sourceCode } = await importPage(params.mdxPath, params.lang);
  const outdated = isOutdated(params.lang, params.mdxPath);
  const t = uiTranslator(params.lang);
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={replaceReleaseToken(sourceCode)}>
      {outdated && (
        <p className="site-outdated">
          <strong>{t("outdated.title")}</strong>{" "}
          <a href={`${basePath}/en/${params.mdxPath.join("/")}/`} hrefLang="en">
            {t("outdated.link")}
          </a>
        </p>
      )}
      {/* <Shot> needs the page's language to pick its localized image; MDX never passes it */}
      <MDXContent
        params={params}
        components={{ Shot: (p: React.ComponentProps<typeof Shot>) => <Shot {...p} lang={params.lang} /> }}
      />
    </Wrapper>
  );
}
