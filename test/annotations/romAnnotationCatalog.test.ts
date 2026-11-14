import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { machineRegistry } from "@common/machines/machine-registry";
import { KNOWN_ROM_PAGES, romCrc32 } from "@common/roms/romIdentity";
import {
  ROM_ANNOTATION_CATALOG,
  catalogPagesOf,
  ownPagesOf,
  romAnnotationOpenCommand,
  romCatalogFileName,
  romCatalogFiles
} from "@common/roms/romAnnotationCatalog";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";

/*
 * The Debug › ROM Annotations menu's table, kept in step
 * with the ROMs Klive knows (`KNOWN_ROM_PAGES`), the shipped sidecars' index and the shipped files.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const index: Record<string, { sidecar: string; page: number }> = JSON.parse(
  readFileSync(join(ROMS, "rom-annotations.index.json"), "utf8")
);
const entries = ROM_ANNOTATION_CATALOG.flatMap((machine) => machine.groups.flat());

function crcOf(file: string, page = 0): string | undefined {
  const bytes = new Uint8Array(readFileSync(join(ROMS, file)));
  const start = page * 0x4000;
  return start < bytes.length ? romCrc32(bytes.subarray(start, Math.min(bytes.length, start + 0x4000))) : undefined;
}

describe("ROM_ANNOTATION_CATALOG", () => {
  it("names registered machine types, each once, with no empty group", () => {
    const ids = ROM_ANNOTATION_CATALOG.map((machine) => machine.machineId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const machine of ROM_ANNOTATION_CATALOG) {
      expect(machineRegistry.some((info) => info.machineId === machine.machineId), machine.machineId).toBe(true);
      expect(machine.groups.length).toBeGreaterThan(0);
      for (const group of machine.groups) expect(group.length).toBeGreaterThan(0);
    }
  });

  it("lists only pages of shipped files that Klive knows or ships annotations for", () => {
    for (const entry of entries) {
      const name = `${entry.file}${entry.page === undefined ? "" : `:${entry.page}`}`;
      expect(existsSync(join(ROMS, entry.file)), name).toBe(true);
      const crc = crcOf(entry.file, entry.page);
      expect(crc, name).toBeDefined();
      expect(!!KNOWN_ROM_PAGES[crc!] || !!index[crc!], name).toBe(true);
    }
  });

  it("gives a multi-page file its page, and a single-page file none", () => {
    for (const entry of entries) {
      const size = readFileSync(join(ROMS, entry.file)).length;
      expect(entry.page === undefined, entry.file).toBe(size <= 0x4000);
    }
  });

  it("covers every page Klive knows and every page with a shipped sidecar", () => {
    const listed = new Set(entries.map((entry) => crcOf(entry.file, entry.page)));
    for (const [crc, known] of Object.entries(KNOWN_ROM_PAGES)) {
      expect(listed.has(crc), `${known.file} page ${known.page ?? 0}`).toBe(true);
    }
    for (const [crc, shipped] of Object.entries(index)) {
      expect(listed.has(crc), `${shipped.sidecar} page ${shipped.page}`).toBe(true);
    }
  });

  it("opens a page with rom-ann-open, creating annotations when there are none", () => {
    expect(romAnnotationOpenCommand({ file: "sp48.rom" })).toBe("rom-ann-open sp48.rom -create");
    const next = "zxnext/nextzxos-2.08/enNextZX.rom";
    expect(romAnnotationOpenCommand({ file: next, page: 0 })).toBe(`rom-ann-open ${next} -create`);
    expect(romAnnotationOpenCommand({ file: next, page: 2 })).toBe(`rom-ann-open ${next} -page 2 -create`);
  });

  it("lists each Next ROM set's files by their paths, in the five groups of a set", () => {
    const next = ROM_ANNOTATION_CATALOG.find((machine) => machine.machineId === "zxnext")!;
    const sets = Object.values(NEXT_ROM_SETS);
    // --- A set without an FPGA boot ROM (nextzxos-26.11: core 3.03's is not published) has four groups
    expect(next.groups.length).toBe(sets.reduce((sum, set) => sum + (Object.keys(set.fpgaRoms).length ? 5 : 4), 0));
    expect(next.groups.slice(0, 5).map((group) => group.map((entry) => romCatalogFileName(entry)))).toEqual([
      ["enNextZX.rom", "enNextZX.rom", "enNextZX.rom", "enNextZX.rom"],
      ["enNextLG.rom", "enNextLG.rom", "enNextLG.rom", "enNextLG.rom"],
      ["enAltZX.rom", "enAltZX.rom"],
      ["enNxtmmc.rom", "enNextMf.rom"],
      ["bootrom_ab.bin"]
    ]);
    expect(next.groups[0][3]).toEqual({ file: "zxnext/nextzxos-2.08/enNextZX.rom", page: 3 });
    for (const entry of next.groups.flat()) expect(entry.file).toMatch(/^zxnext\/[^/]+\/[^/]+\.(rom|bin)$/);
    // --- The anti-brick boot ROM of each set, an FPGA ROM, is listed with the set's files
    expect(next.groups[4]).toEqual([{ file: "zxnext/nextzxos-2.08/bootrom_ab.bin" }]);
  });
});

describe("a ROM file's pages", () => {
  it("lists each file once per group, without its pages", () => {
    const z88 = ROM_ANNOTATION_CATALOG.find((machine) => machine.machineId === "z88")!;
    expect(romCatalogFiles(z88)).toEqual([[{ file: "z88v47.rom" }]]);
    for (const machine of ROM_ANNOTATION_CATALOG) {
      for (const group of romCatalogFiles(machine)) {
        const files = group.map((entry) => entry.file);
        expect(new Set(files).size, machine.machineId).toBe(files.length);
        expect(group.every((entry) => entry.page === undefined), machine.machineId).toBe(true);
      }
    }
  });

  it("knows the pages of a file the catalog lists", () => {
    expect(catalogPagesOf("z88v47.rom")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 31]);
    expect(catalogPagesOf("sp48.rom")).toEqual([0]);
  });

  it("gives a file only the pages no other shipped sidecar describes", () => {
    const next = "zxnext/nextzxos-2.08/enNextLG.rom";
    const zx = "zxnext/nextzxos-2.08/enNextZX.rom";
    // --- enNextLG.rom differs from enNextZX.rom in page 2 only: its other pages are enNextZX.rom.dis's
    expect(ownPagesOf(next, (p) => crcOf(next, p), index)).toEqual([2]);
    expect(ownPagesOf(zx, (p) => crcOf(zx, p), index)).toEqual([0, 1, 2, 3]);
    // --- A file no shipped sidecar describes owns every page the catalog knows
    expect(ownPagesOf("z88v47.rom", (p) => crcOf("z88v47.rom", p), index)).toEqual(catalogPagesOf("z88v47.rom"));
  });
});

