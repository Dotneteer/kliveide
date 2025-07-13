// CommonJS module format using dynamic import
// @ts-nocheck

// Use a self-executing async function to enable top-level await
const withNextra = async () => {
  // Dynamically import nextra
  const { default: nextra } = await import('nextra');
  
  return nextra({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.jsx'
  });
};

// Use dynamic configuration with promises
module.exports = async () => {
  const nextраConfig = await withNextra();
  const isProduction = process.env.NODE_ENV === 'production';

  return nextраConfig({
    output: 'export',
    basePath: isProduction ? '/kliveide' : '',
    distDir: 'docs-out',
    images: {
      unoptimized: true,
    },
  });
}
