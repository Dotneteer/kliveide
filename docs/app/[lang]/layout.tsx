/**
 * Root layout for every page under /<lang>/ (the documentation, and later the translated
 * landing pages). It only owns <html>/<head>/<body>; the Nextra chrome lives in
 * `(docs)/layout.tsx`, so a page in another group under [lang] can render without it.
 *
 * "/" has its own root layout in `app/(root)` (the English landing page).
 */
import { Head } from "nextra/components";
import { LOCALES } from "../../i18n/locales.mjs";
import { fontVariables } from "../fonts";
import "../tokens.css";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Only the locales above exist; anything else under "/" is a 404, not a render.
export const dynamicParams = false;

type LayoutProps = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>;

export default async function LangRootLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  return (
    <html lang={lang} dir="ltr" className={fontVariables} suppressHydrationWarning>
      {/* Nextra's accent and page background: the app's Sinclair Blue and canvas (app/tokens.css) */}
      <Head
        color={{
          hue: { dark: 204, light: 205 },
          saturation: { dark: 76, light: 90 },
          lightness: { dark: 59, light: 38 }
        }}
        backgroundColor={{ dark: "#141517", light: "#ffffff" }}
      />
      <body>{children}</body>
    </html>
  );
}
