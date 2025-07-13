// This file is explicitly an ES Module due to the .mjs extension
// Next.js supports both .js and .mjs for the config file

export default async function nextConfig() {
  // Dynamically import `nextra`
  const { default: nextra } = await import('nextra');

  // Create the wrapped configuration
  const withNextra = nextra({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.jsx'
  });

  const isProduction = process.env.NODE_ENV === 'production';

  return withNextra({
    output: 'export',
    basePath: isProduction ? '/kliveide' : '',
    distDir: 'docs-out',
    images: {
      unoptimized: true,
    },
  });
}
