import React from "react";
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <img src="/images/klive-logo.svg" alt="KliveIDE" width="50px" height="50px" />
      <span style={{ fontWeight: "bold", fontSize: "2em" }}>Klive IDE</span>
    </div>
  ),
  project: {
    link: "https://github.com/Dotneteer/kliveide"
  },
  docsRepositoryBase: "https://github.com/dotneteer/klive",
  footer: {
    content: "KliveIDE Documentation © 2025"
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="KliveIDE Documentation" />
      <meta property="og:description" content="The comprehensive guide to KliveIDE" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    backToTop: true
  },
  search: {
    placeholder: "Search documentation..."
  },
  editLink: {
    component: null
  },
  feedback: {
    content: null
  }
};

export default config;
