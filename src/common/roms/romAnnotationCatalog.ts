import { MI_HT1080Z, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TVC, MI_ZX80, MI_ZX81, MI_ZXNEXT } from "@common/machines/constants";

/*
 * The ROMs the Debug › ROM Annotations menu offers, by machine type (`.plans/ROM_ANNOTATIONS_MENU_PLAN.md`
 * D2). Every ROM page Klive ships and knows — the pages of `KNOWN_ROM_PAGES` and every page with a
 * shipped sidecar — is listed here, under each ROM set that has it (a page two sets share opens the
 * same annotations: they are found by the page's bytes). `test/annotations/romAnnotationCatalog.test.ts`
 * keeps the table in step with both sources and with the files in `src/public/roms`.
 */

/** One ROM page: a file in `src/public/roms`, and its 16K page when the file has several. */
export type RomCatalogEntry = { file: string; page?: number };

/** A machine type's ROMs, in groups (one per ROM set) the menu separates. */
export type RomCatalogMachine = { machineId: string; groups: RomCatalogEntry[][] };

const pages = (file: string, count: number): RomCatalogEntry[] =>
  Array.from({ length: count }, (_, page) => ({ file, page }));
const files = (...names: string[]): RomCatalogEntry[] => names.map((file) => ({ file }));
const p3Set = (stem: string): RomCatalogEntry[] =>
  Array.from({ length: 4 }, (_, index) => ({ file: `${stem}-${index}.rom` }));

export const ROM_ANNOTATION_CATALOG: readonly RomCatalogMachine[] = [
  { machineId: MI_SPECTRUM_48, groups: [files("sp48.rom")] },
  { machineId: MI_SPECTRUM_128, groups: [files("sp128-0.rom", "sp128-1.rom")] },
  {
    machineId: MI_SPECTRUM_3E,
    // --- The +3E set's ROM 3 is v4.0's, byte for byte: it opens the same annotations, found by its bytes
    groups: [p3Set("spp3-40"), p3Set("spp3-41"), p3Set("spp3-41es"), p3Set("spp3e")]
  },
  {
    machineId: MI_ZXNEXT,
    groups: [
      pages("enNextZX.rom", 4),
      pages("enNextLG.rom", 4),
      pages("enAltZX.rom", 2),
      files("enNxtmmc.rom", "enNextMf.rom")
    ]
  },
  { machineId: MI_ZX81, groups: [files("zx81.rom")] },
  { machineId: MI_ZX80, groups: [files("zx80.rom")] },
  {
    machineId: MI_HT1080Z,
    // --- Series I and II share one BASIC image (ht1080z-s2.rom is ht1080z-s1.rom): both open its annotations
    groups: [
      files("ht1080z-s1.rom", "ht1080z-s1-ext.rom", "ht1080z-s1-chargen.rom"),
      files("ht1080z-s2.rom", "ht1080z-s2-ext.rom", "ht1080z-s2-chargen.rom"),
      files("ht1080z-s64.rom", "ht1080z-s64-ext.rom", "ht1080z-s64-chargen.rom")
    ]
  },
  {
    machineId: MI_TVC,
    groups: [files("tvc12-d4.rom", "tvc12-d3.rom", "tvc12-d7.rom"), files("tvc22-d6.rom", "tvc22-d4.rom", "tvc22-d7.rom")]
  }
];

/** The IDE command that opens a ROM page's annotations, making an empty working copy when it has none. */
export function romAnnotationOpenCommand(entry: RomCatalogEntry): string {
  return `rom-ann-open ${entry.file}${entry.page ? ` -page ${entry.page}` : ""} -create`;
}
