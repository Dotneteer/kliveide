/**
 * Root layout for every page under /<lang>/ (the documentation, and later the translated
 * landing pages). It only owns <html>/<head>/<body>; the Nextra chrome lives in
 * `(docs)/layout.tsx`, so a page in another group under [lang] can render without it.
 *
 * "/" has its own root layout in `app/(root)` (the English landing page).
 */
import { Head } from "nextra/components";
import { LOCALES } from "../../i18n/locales.mjs";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Only the locales above exist; anything else under "/" is a 404, not a render.
export const dynamicParams = false;

type LayoutProps = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>;

export default async function LangRootLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  return (
    <html lang={lang} dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  );
}
