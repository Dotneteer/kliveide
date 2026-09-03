/**
 * Root layout for the docs site.
 *
 * Nextra 4 removed `theme.config.tsx`; everything it configured is now props on
 * <Layout>, <Navbar>, <Footer> and <Search>, and the static <head> content moved to
 * the Next.js Metadata API. This file is the direct port of the old theme config -
 * see the mapping table in .plans/NEXTRA_4_NEXT_16_DOCS_MIGRATION_PLAN.md (4.3).
 */
import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head, Search } from "nextra/components";
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
    title: "KliveIDE Documentation",
    description: "The comprehensive guide to KliveIDE"
  }
};

const navbar = (
  <Navbar
    logo={
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={`${basePath}/images/klive-logo.svg`}
          alt="KliveIDE"
          width="50px"
          height="50px"
        />
        <span style={{ fontWeight: "bold", fontSize: "2em" }}>Klive IDE</span>
      </div>
    }
    projectLink="https://github.com/Dotneteer/kliveide"
  />
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap();
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/dotneteer/klive"
          search={<Search placeholder="Search documentation..." />}
          sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
          // `toc.backToTop` was a boolean in Nextra 3; in 4 it is the label node.
          toc={{ backToTop: "Scroll to top" }}
          editLink={null}
          feedback={{ content: null }}
          footer={<Footer />}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
