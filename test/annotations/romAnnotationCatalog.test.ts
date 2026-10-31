import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { machineRegistry } from "@common/machines/machine-registry";
import { KNOWN_ROM_PAGES, romCrc32 } from "@common/roms/romIdentity";
import {
  ROM_ANNOTATION_CATALOG,
  romAnnotationOpenCommand,
  romCatalogFileName
} from "@common/roms/romAnnotationCatalog";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";

/*
 * The Debug › ROM Annotations menu's table (`.plans/ROM_ANNOTATIONS_MENU_PLAN.md` D2), kept in step
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

  it("lists each Next ROM set's files by their paths, in the four groups of a set", () => {
    const next = ROM_ANNOTATION_CATALOG.find((machine) => machine.machineId === "zxnext")!;
    const sets = Object.keys(NEXT_ROM_SETS);
    expect(next.groups.length).toBe(4 * sets.length);
    expect(next.groups.slice(0, 4).map((group) => group.map((entry) => romCatalogFileName(entry)))).toEqual([
      ["enNextZX.rom", "enNextZX.rom", "enNextZX.rom", "enNextZX.rom"],
      ["enNextLG.rom", "enNextLG.rom", "enNextLG.rom", "enNextLG.rom"],
      ["enAltZX.rom", "enAltZX.rom"],
      ["enNxtmmc.rom", "enNextMf.rom"]
    ]);
    expect(next.groups[0][3]).toEqual({ file: "zxnext/nextzxos-2.08/enNextZX.rom", page: 3 });
    for (const entry of next.groups.flat()) expect(entry.file).toMatch(/^zxnext\/[^/]+\/[^/]+\.rom$/);
  });
});
