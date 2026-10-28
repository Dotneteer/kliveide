/**
 * The documentation chrome (Nextra's <Layout>, navbar, search, footer) of the docs pages, the
 * `(docs)` route group. The <html> shell is `./layout.tsx`.
 *
 * Nextra 4 removed `theme.config.tsx`; everything it configured is now props on
 * <Layout>, <Navbar>, <Footer> and <Search>. The chrome's text comes from docs/i18n/ui/<lang>.json
 * (§4 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md).
 */
import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { LOCALE_NAMES, LOCALES } from "../../i18n/locales.mjs";
import { uiTranslator } from "../../i18n/ui";
import DocsLanguageSwitch from "../../page-components/DocsLanguageSwitch";
import "nextra-theme-docs/style.css";
import "./(docs)/custom.css";

// Must match `basePath` in next.config.mjs; see docs/.env.production.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const docsMetadata: Metadata = {
  title: {
    default: "Klive IDE Documentation",
    template: "%s - Klive IDE"
  },
  description: "The comprehensive guide to Klive IDE",
  openGraph: {
    title: "Klive IDE Documentation",
    description: "The comprehensive guide to Klive IDE"
  },
  icons: { icon: `${basePath}/images/klive-logo.svg` }
};

type PageMapNode = { route?: string; children?: PageMapNode[] };

/** Every page route of a page map ("/de/get-started/install"). */
function routesOf(nodes: PageMapNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.route) out.push(node.route.replace(/\/$/, ""));
    if (node.children) routesOf(node.children, out);
  }
  return out;
}

type DocsShellProps = Readonly<{
  children: React.ReactNode;
  lang: string;
}>;

export async function DocsShell({ children, lang }: DocsShellProps) {
  const t = uiTranslator(lang);
  const pageMap = await getPageMap(`/${lang}`);
  const routes: Record<string, string[]> = {};
  for (const locale of LOCALES) routes[locale] = routesOf((await getPageMap(`/${locale}`)) as PageMapNode[]);
  const languages: [string, string][] = LOCALES.map((id: string) => [id, (LOCALE_NAMES as Record<string, string>)[id] ?? id]);

  const navbar = (
    <Navbar
      logo={
        <span className="site-brand">
          <img src={`${basePath}/images/klive-logo.svg`} alt="" width={28} height={28} />
          <span>Klive IDE</span>
        </span>
      }
      logoLink={lang === "en" ? "/" : `/${lang}/`}
      projectLink="https://github.com/Dotneteer/kliveide"
    >
      <DocsLanguageSwitch label={t("language.label")} languages={languages} routes={routes} />
    </Navbar>
  );

  return (
    <Layout
      navbar={navbar}
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/Dotneteer/kliveide/tree/master/docs"
      search={
        <Search
          placeholder={t("search.placeholder")}
          emptyResult={t("search.empty")}
          errorText={t("search.error")}
          loading={t("search.loading")}
        />
      }
      sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
      toc={{ title: t("toc.title"), backToTop: t("toc.backToTop") }}
      editLink={t("editLink")}
      themeSwitch={{ dark: t("theme.dark"), light: t("theme.light"), system: t("theme.system") }}
      feedback={{ content: null }}
      footer={<Footer>{t("footer.text")}</Footer>}
    >
      {children}
    </Layout>
  );
}
