/**
 * Layout for the documentation pages (/<lang>/...). The <html> shell is `../layout.tsx`.
 *
 * Nextra 4 removed `theme.config.tsx`; everything it configured is now props on
 * <Layout>, <Navbar>, <Footer> and <Search>, and the static <head> content moved to
 * the Next.js Metadata API. This file is the direct port of the old theme config -
 * see the mapping table in .plans/NEXTRA_4_NEXT_16_DOCS_MIGRATION_PLAN.md (4.3).
 */
import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./custom.css";

// Must match `basePath` in next.config.mjs; see docs/.env.production.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: {
    default: "Klive IDE Documentation",
    template: "%s - Klive IDE"
  },
  description: "The comprehensive guide to Klive IDE",
  openGraph: {
    title: "Klive IDE Documentation",
    description: "The comprehensive guide to Klive IDE"
  }
};

const navbar = (
  <Navbar
    logo={
      <span className="site-brand">
        <img src={`${basePath}/images/klive-logo.svg`} alt="" width={28} height={28} />
        <span>Klive IDE</span>
      </span>
    }
    projectLink="https://github.com/Dotneteer/kliveide"
  />
);

type LayoutProps = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>;

export default async function DocsLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  const pageMap = await getPageMap(`/${lang}`);
  return (
    <Layout
      navbar={navbar}
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/Dotneteer/kliveide/tree/master/docs"
      search={<Search placeholder="Search documentation..." />}
      sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
      // `toc.backToTop` was a boolean in Nextra 3; in 4 it is the label node.
      toc={{ backToTop: "Scroll to top" }}
      editLink="Edit this page on GitHub"
      feedback={{ content: null }}
      footer={<Footer />}
    >
      {children}
    </Layout>
  );
}
