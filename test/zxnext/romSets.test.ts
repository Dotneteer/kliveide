import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { KNOWN_ROM_PAGES, romCrc32 } from "@common/roms/romIdentity";
import { NEXT_ROM_SETS, nextRomAnnotationFile } from "@common/zxnext/romSets";

/*
 * The ZX Spectrum Next's ROM sets (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D9.3): every set in the
 * manifest against the committed files, and the ROM identity table generated from it. No network:
 * `npm run next-roms:check -- --online` is the provenance check.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const sets = Object.values(NEXT_ROM_SETS);

describe("the Next ROM sets", () => {
  it("are there", () => {
    expect(sets.map((set) => set.id)).toContain("nextzxos-2.08");
  });

  describe.each(sets.flatMap((set) => Object.entries(set.files).map(([file, info]) => ({ set, file, info }))))(
    "$set.id/$file",
    ({ set, file, info }) => {
      const path = join(ROMS, nextRomAnnotationFile(set.id, file));

      it("is committed with the manifest's size and sha256", () => {
        expect(existsSync(path)).toBe(true);
        const bytes = readFileSync(path);
        expect(bytes.length).toBe(info.size);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(info.sha256);
      });

      it("has the manifest's page CRCs", () => {
        const bytes = new Uint8Array(readFileSync(path));
        const crcs: string[] = [];
        for (let start = 0; start < bytes.length; start += 0x4000) {
          crcs.push(romCrc32(bytes.subarray(start, Math.min(bytes.length, start + 0x4000))));
        }
        expect(crcs).toEqual(info.pages);
      });

      it("has every page in KNOWN_ROM_PAGES, named by a set's path to a file with those bytes", () => {
        info.pages.forEach((crc, page) => {
          const known = KNOWN_ROM_PAGES[crc];
          expect(known, `${file} page ${page}`).toBeDefined();
          // --- A page listed once for several files (enNextLG's pages but 2 are enNextZX's) names one of them
          expect(known.file).toMatch(/^zxnext\/[^/]+\/[^/]+\.rom$/);
          const bytes = new Uint8Array(readFileSync(join(ROMS, known.file)));
          const at = known.page ?? 0;
          expect(romCrc32(bytes.subarray(at * 0x4000, Math.min(bytes.length, (at + 1) * 0x4000)))).toBe(crc);
        });
      });
    }
  );

  it("names its own files for the pages only it has", () => {
    for (const set of sets) {
      const elsewhere = new Set(
        sets.filter((other) => other !== set).flatMap((other) => Object.values(other.files).flatMap((f) => f.pages))
      );
      for (const [file, info] of Object.entries(set.files)) {
        info.pages.forEach((crc) => {
          if (elsewhere.has(crc)) return;
          expect(KNOWN_ROM_PAGES[crc].file.startsWith(`zxnext/${set.id}/`), `${set.id}/${file}`).toBe(true);
        });
      }
    }
  });

  it("has every page described by a shipped sidecar of its own set (D8)", () => {
    const index = JSON.parse(readFileSync(join(ROMS, "rom-annotations.index.json"), "utf8"));
    for (const set of sets) {
      for (const [file, info] of Object.entries(set.files)) {
        info.pages.forEach((crc, page) => {
          const entry = index[crc];
          expect(entry, `${set.id}/${file} page ${page}`).toBeDefined();
          // --- A page shared with another file of the set (enNextLG's but 2) is that file's
          expect(entry.sidecar.startsWith(`zxnext/${set.id}/`), `${set.id}/${file} page ${page}`).toBe(true);
          expect(existsSync(join(ROMS, entry.sidecar))).toBe(true);
        });
      }
    }
  });

  it("keeps the nextzxos-2.08 pages' kinds", () => {
    const file = (name: string) => nextRomAnnotationFile("nextzxos-2.08", name);
    expect(KNOWN_ROM_PAGES["95ba84d4"]).toEqual({ file: file("enNextZX.rom"), kind: "next-os0", page: 0 });
    expect(KNOWN_ROM_PAGES["74dbb504"]).toEqual({ file: file("enNextZX.rom"), kind: "next-os1", page: 1 });
    expect(KNOWN_ROM_PAGES["cafb1e32"]).toEqual({ file: file("enNextZX.rom"), kind: "next-os2", page: 2 });
    expect(KNOWN_ROM_PAGES["92d23960"]).toEqual({ file: file("enNextZX.rom"), kind: "next-basic", page: 3 });
    expect(KNOWN_ROM_PAGES["43fc1f2f"]).toEqual({ file: file("enNextLG.rom"), kind: "next-os2", page: 2 });
    expect(KNOWN_ROM_PAGES["574ec214"]).toEqual({ file: file("enAltZX.rom"), kind: "next-alt0", page: 0 });
    expect(KNOWN_ROM_PAGES["74bc5674"]).toEqual({ file: file("enAltZX.rom"), kind: "next-alt1", page: 1 });
    expect(KNOWN_ROM_PAGES["5a443736"]).toEqual({ file: file("enNxtmmc.rom"), kind: "next-divmmc" });
    expect(KNOWN_ROM_PAGES["36db4453"]).toEqual({ file: file("enNextMf.rom"), kind: "next-multiface" });
  });
});
