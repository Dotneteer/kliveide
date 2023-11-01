const withNextra = require("nextra")({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.jsx"
});

const isProduction = process.env.NODE_ENV === "production";
module.exports = withNextra({
  output: "export",
  basePath: isProduction ? '/kliveide' : "",
  distDir: "docs-out",
  images: {
    unoptimized: true,
  },
});

// If you have other Next.js configurations, you can pass them as the parameter:
// module.exports = withNextra({ /* other next.js config */ })
