import { NEXT_ROM_SETS, nextRomAnnotationFile, type NextRomSet } from "@common/zxnext/romSets";
import {
  MI_ENTERPRISE,
  MI_HT1080Z,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TVC,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";

/*
 * The ROMs the Debug › ROM Annotations menu offers, by machine type.
 * Every ROM page Klive ships and knows — the pages of `KNOWN_ROM_PAGES` and every page with a
 * shipped sidecar — is listed here, under each ROM set that has it (a page two sets share opens the
 * same annotations: they are found by the page's bytes). `test/annotations/romAnnotationCatalog.test.ts`
 * keeps the table in step with both sources and with the files in `src/public/roms`.
 */

/**
 * One ROM page: a file by its path relative to `src/public/roms` (`sp48.rom`,
 * `zxnext/nextzxos-2.08/enNextZX.rom`), and its 16K page when the file has several.
 */
export type RomCatalogEntry = { file: string; page?: number };

/** A machine type's ROMs, in groups (one per ROM set) the menu separates. */
export type RomCatalogMachine = { machineId: string; groups: RomCatalogEntry[][] };

const pages = (file: string, count: number): RomCatalogEntry[] =>
  Array.from({ length: count }, (_, page) => ({ file, page }));
const files = (...names: string[]): RomCatalogEntry[] => names.map((file) => ({ file }));
const p3Set = (stem: string): RomCatalogEntry[] =>
  Array.from({ length: 4 }, (_, index) => ({ file: `${stem}-${index}.rom` }));

/**
 * A Next ROM set's groups: NextZXOS, its LG variant, the alternate ROM, the DivMMC and Multiface
 * ROMs, then the anti-brick core's boot ROM (an FPGA ROM shipped beside the set's files). A file of
 * the set is listed once per 16K page it has.
 */
function nextSetGroups(set: NextRomSet): RomCatalogEntry[][] {
  const entriesOf = (file: string): RomCatalogEntry[] => {
    const info = set.files[file] ?? set.fpgaRoms[file];
    if (!info) return [];
    const path = nextRomAnnotationFile(set.id, file);
    return info.pages.length > 1 ? pages(path, info.pages.length) : files(path);
  };
  return [["enNextZX.rom"], ["enNextLG.rom"], ["enAltZX.rom"], ["enNxtmmc.rom", "enNextMf.rom"], ["bootrom_ab.bin"]]
    .map((group) => group.flatMap(entriesOf))
    .filter((group) => group.length > 0);
}

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
    // --- Each ROM set's groups in turn, its files named by their paths (`romSets.ts`)
    groups: Object.values(NEXT_ROM_SETS).flatMap(nextSetGroups)
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
  },
  {
    machineId: MI_ENTERPRISE,
    // --- The 128's EXOS 2.1 and IS-BASIC 2.1, the 64's EXOS 2.0 and IS-BASIC 2.0, then the EXDOS card's ROM
    groups: [
      [...pages("ep-exos21.rom", 2), ...files("ep-basic21.rom")],
      [...pages("ep-exos20.rom", 2), ...files("ep-basic20.rom")],
      pages("ep-exdos13.rom", 2)
    ]
  },
  {
    machineId: MI_Z88,
    // --- OZ 4.7: the banks that hold something (`KNOWN_ROM_PAGES`); the empty ones are left out
    groups: [
      [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x10, 0x1f].map((page) => ({
        file: "z88v47.rom",
        page
      }))
    ]
  }
];

/**
 * A machine type's ROM files, in catalog order, each once: what the menu lists. A file's pages are not
 * menu items; the ROM annotation editor lists them (`ownPagesOf`).
 */
export function romCatalogFiles(machine: RomCatalogMachine): RomCatalogEntry[][] {
  return machine.groups
    .map((group) => {
      const seen = new Set<string>();
      return group.filter((entry) => !seen.has(entry.file) && seen.add(entry.file)).map(({ file }) => ({ file }));
    })
    .filter((group) => group.length > 0);
}

/** The pages of a ROM file the catalog lists (every page Klive knows of it), in page order. */
export function catalogPagesOf(file: string, catalog: readonly RomCatalogMachine[] = ROM_ANNOTATION_CATALOG): number[] {
  const pages = new Set<number>();
  for (const machine of catalog) {
    for (const entry of machine.groups.flat()) if (entry.file === file) pages.add(entry.page ?? 0);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * The pages of a ROM file that its own sidecar describes: the catalog's pages whose bytes no other
 * shipped sidecar describes. `enNextLG.rom` differs from `enNextZX.rom` in page 2 only, so its other
 * pages are `enNextZX.rom.dis`'s and only page 2 is its own.
 *
 * @param file The file, by its path under `roms/` (`zxnext/nextzxos-2.08/enNextLG.rom`)
 * @param crcOf A page's CRC-32, or `undefined` when the file has no such page
 * @param index The shipped sidecars by page CRC (`rom-annotations.index.json`)
 */
export function ownPagesOf(
  file: string,
  crcOf: (page: number) => string | undefined,
  index: Readonly<Record<string, { sidecar: string; page: number }>>,
  catalog: readonly RomCatalogMachine[] = ROM_ANNOTATION_CATALOG
): number[] {
  return catalogPagesOf(file, catalog).filter((page) => {
    const crc = crcOf(page);
    if (crc === undefined) return false;
    const shipped = index[crc];
    return !shipped || shipped.sidecar === `${file}.dis`;
  });
}

/** A catalog entry's file name, without its folder: what the menu shows (`enNextZX.rom`). */
export function romCatalogFileName(entry: RomCatalogEntry): string {
  return entry.file.split("/").pop() ?? entry.file;
}

/**
 * The IDE command that opens a ROM page's annotations, making an empty working copy when it has none.
 * The file is named by its path under `src/public/roms`, which `rom-ann-open` looks up there first.
 */
export function romAnnotationOpenCommand(entry: RomCatalogEntry): string {
  return `rom-ann-open ${entry.file}${entry.page ? ` -page ${entry.page}` : ""} -create`;
}
