/**
 * Layout for the Cambridge Z88 User Guide (/<lang>/z88-user-guide/...), imported for its author's
 * review and reachable by URL only. Its pages get the docs chrome with the guide's own sidebar,
 * which only this layout shows (see `UNLISTED_WITH_SIDEBAR` in `../../docs-shell.tsx`).
 */
import type { Metadata } from "next";
import { DocsShell, docsMetadata } from "../../docs-shell";

export const metadata: Metadata = docsMetadata;

const AREA = "z88-user-guide";

type LayoutProps = Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>;

export default async function Z88UserGuideLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  return (
    <DocsShell lang={lang} area={AREA}>
      {children}
    </DocsShell>
  );
}
