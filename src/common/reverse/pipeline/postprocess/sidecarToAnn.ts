import type { Provenance, RawRomSidecar } from "@common/roms/romAnnotationTools";
import { emptyAnnDocument, writeAnn, type AnnDocument, type AnnProvenanceKind } from "../annFormat";
import type { Cpu } from "../image/cpu";
import { annRegionOf, type SidecarRegion } from "./regionKinds";

/*
 * One page of a ROM sidecar as a `.ann` document (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P1, D6):
 * what `export-ann` writes, and the first half of the round trip that proves the format loses
 * nothing. The most common provenance on the page becomes the default; the others are listed.
 */

export type SidecarPageToAnnOptions = {
  /** The ROM file the header names; the sidecar's `source.fileName` when absent. */
  rom?: string;
  cpu: Cpu;
  /** Comment lines written above the header. */
  preamble?: readonly string[];
};

/** The page's annotations as a document. Throws when the sidecar has no bank for the page. */
export function sidecarPageToAnnDocument(sidecar: RawRomSidecar, page: number, options: SidecarPageToAnnOptions): AnnDocument {
  const bank = sidecar.banks?.[String(page)];
  if (!bank) throw new Error(`The sidecar has no bank for page ${page}`);
  const rom = options.rom ?? sidecar.source?.fileName;
  if (!rom) throw new Error("The sidecar names no ROM file (source.fileName); pass one");

  const document = emptyAnnDocument();
  document.header = { rom, page, cpu: options.cpu };
  document.regions = (bank.regions ?? []).map((r: SidecarRegion) => annRegionOf(r));
  document.labels = (bank.localLabels ?? []).map((l: { name: string; value: number }) => ({
    offset: l.value,
    name: l.name,
    line: 0
  }));
  for (const [key, entry] of Object.entries<{ synopsis?: string; comment?: string }>(bank.lineAnnotations ?? {})) {
    const offset = Number(key);
    if (entry.synopsis !== undefined) document.synopses.push({ offset, text: entry.synopsis, line: 0 });
    if (entry.comment !== undefined) document.comments.push({ offset, text: entry.comment, line: 0 });
  }

  // --- Provenance: the page's most common value is the default, every other entry is listed
  const prefix = `${page}:`;
  const marks = Object.entries<Provenance>(sidecar.provenance ?? {})
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, provenance]) => {
      const [, offset, kind] = key.split(":");
      return { offset: Number(offset), kind: kind as AnnProvenanceKind, provenance, line: 0 };
    });
  const counts = new Map<Provenance, number>();
  for (const mark of marks) counts.set(mark.provenance, (counts.get(mark.provenance) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  document.defaultProvenance = ranked[0]?.[0] ?? "observed";
  document.provenance = marks.filter((m) => m.provenance !== document.defaultProvenance);
  return document;
}

/** The page's annotations as `.ann` text. */
export function sidecarPageToAnn(sidecar: RawRomSidecar, page: number, options: SidecarPageToAnnOptions): string {
  return writeAnn(sidecarPageToAnnDocument(sidecar, page, options), options.preamble);
}
