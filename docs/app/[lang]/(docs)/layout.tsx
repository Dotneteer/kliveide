/**
 * Layout for the documentation pages (/<lang>/...): the chrome is `../docs-shell.tsx`, shared
 * with the unlisted areas in `../(unlisted)/`. The <html> shell is `../layout.tsx`.
 */
import type { Metadata } from "next";
import { DocsShell, docsMetadata } from "../docs-shell";

export const metadata: Metadata = docsMetadata;

type LayoutProps = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>;

export default async function DocsLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  return <DocsShell lang={lang}>{children}</DocsShell>;
}
