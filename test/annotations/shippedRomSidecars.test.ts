import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

import { parseAnnotations, isValidLabelName } from "@renderer/appIde/annotations/programAnnotations";
import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import {
  buildRomIndex,
  formatRomIndex,
  formatRomSidecar,
  measureRomLevel,
  missingProvenance,
  strayProvenance
} from "@common/roms/romAnnotationTools";
import { knownRomPageKind, romPageIdentity } from "@common/roms/romIdentity";
import { withInheritedEntries } from "@renderer/appIde/annotations/romInheritance";
import { canonicalShippedSidecar } from "@common/roms/romSidecarPaths";

/*
 * Every shipped ROM sidecar (`src/public/roms/*.rom.dis`), checked as §7 of
 * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` asks. Unit tier: they need the ROM bytes and
 * Klive's disassembler, not a core.
 */

const ROMS = join(__dirname, "../../src/public/roms");
// --- By their paths under src/public/roms: the Next's are in zxnext/<setId>/
const sidecars = readdirSync(ROMS, { recursive: true })
  .map((name) => String(name).split(sep).join("/"))
  .filter((name) => name.endsWith(".rom.dis"))
  .sort();
// --- An `inherits` may name a Next sidecar by its bare, pre-set-folder name (`romSidecarPaths.ts`)
const romOf = (sidecar: string) =>
  new Uint8Array(readFileSync(join(ROMS, canonicalShippedSidecar(sidecar).replace(/\.dis$/, ""))));

describe("the shipped ROM sidecars", () => {
  it("exist", () => {
    expect(sidecars).toContain("sp48.rom.dis");
  });

  describe.each(sidecars)("%s", (name) => {
    const text = readFileSync(join(ROMS, name), "utf8");
    const raw = JSON.parse(text);

    it("sits beside its ROM, whose pages it names by CRC", () => {
      const rom = romOf(name);
      for (const [page, info] of Object.entries<{ crc32: string }>(raw.pages ?? {})) {
        const bytes = rom.subarray(Number(page) * 0x4000, Math.min(rom.length, (Number(page) + 1) * 0x4000));
        expect(romPageIdentity(bytes).crc32, `page ${page}`).toBe(info.crc32);
      }
      for (const page of Object.keys(raw.banks)) expect(raw.pages?.[page], `page ${page}`).toBeDefined();
    });

    it("validates as a ROM sidecar, with no global labels and no debug subtree (§5.1)", () => {
      const parsed = parseAnnotations(text);
      expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(parsed.annotations?.machine).toBe("rom");
      expect(raw.globalLabels).toBeUndefined();
      expect(raw.debug).toBeUndefined();
    });

    it("has valid, unique identifiers for names (A10)", () => {
      for (const bank of Object.values<any>(raw.banks)) {
        const names = (bank.localLabels ?? []).map((label: { name: string }) => label.name);
        expect(new Set(names).size).toBe(names.length);
        for (const label of names) expect(isValidLabelName(label), label).toBe(true);
      }
    });

    it("gives every entry a provenance (§6), and no provenance to anything that is not there", () => {
      expect(missingProvenance(raw)).toEqual([]);
      expect(strayProvenance(raw)).toEqual([]);
      for (const value of Object.values(raw.provenance ?? {})) {
        expect(["observed", "manual", "derived"]).toContain(value);
      }
    });

    it("puts each label on an instruction start inside a code region, per Klive's disassembler", async () => {
      const rom = romOf(name);
      // --- An inheriting sidecar is measured with its inherited, byte-bound entries (its page as shown)
      const pageOf = (page: number) => rom.subarray(page * 0x4000, Math.min(rom.length, (page + 1) * 0x4000));
      const { annotations, missing } = await withInheritedEntries(
        parseAnnotations(text).annotations!,
        pageOf,
        async (sidecar, page) => ({
          annotations: parseAnnotations(readFileSync(join(ROMS, canonicalShippedSidecar(sidecar)), "utf8")).annotations!,
          bytes: romOf(sidecar).subarray(page * 0x4000, (page + 1) * 0x4000)
        })
      );
      expect(missing).toEqual([]);
      for (const [page, bank] of Object.entries<any>(annotations.banks)) {
        const bytes = rom.subarray(Number(page) * 0x4000, Math.min(rom.length, (Number(page) + 1) * 0x4000));
        const report = await measureRomLevel(bank, bytes, romDecoderFor(knownRomPageKind(romPageIdentity(bytes))));
        expect(report.misplacedLabels).toEqual([]);
        // --- The recorded level is never more than the measured one (§5.6)
        expect(report.level).toBeGreaterThanOrEqual(raw.level ?? 0);
      }
    });

    it("is in the canonical format `npm run rom:annotations` writes", () => {
      expect(text).toBe(formatRomSidecar(raw));
    });
  });

  it("has an index that is up to date", () => {
    const index = readFileSync(join(ROMS, "rom-annotations.index.json"), "utf8");
    const described = (sidecar: string) =>
      Object.keys(JSON.parse(readFileSync(join(ROMS, sidecar), "utf8")).banks ?? {}).map(Number);
    expect(index).toBe(
      formatRomIndex(buildRomIndex(sidecars, (rom) => new Uint8Array(readFileSync(join(ROMS, rom))), described))
    );
  });
});

describe("buildRomIndex", () => {
  it("indexes only the pages a sidecar describes", () => {
    // --- enNextLG.rom.dis describes page 2 only; its file's other pages are enNextZX.rom's bytes
    const index = JSON.parse(readFileSync(join(ROMS, "rom-annotations.index.json"), "utf8"));
    expect(index["43fc1f2f"]).toEqual({ sidecar: "zxnext/nextzxos-2.08/enNextLG.rom.dis", page: 2 });
    expect(index["95ba84d4"]).toEqual({ sidecar: "zxnext/nextzxos-2.08/enNextZX.rom.dis", page: 0 });
    expect(index["92d23960"]).toEqual({ sidecar: "zxnext/nextzxos-2.08/enNextZX.rom.dis", page: 3 });
    // --- The same for the nextzxos-2.10 set
    expect(index["fcabc6c7"]).toEqual({ sidecar: "zxnext/nextzxos-2.10/enNextLG.rom.dis", page: 2 });
    expect(index["2f430534"]).toEqual({ sidecar: "zxnext/nextzxos-2.10/enNextZX.rom.dis", page: 0 });
    expect(index["9ced2dbc"]).toEqual({ sidecar: "zxnext/nextzxos-2.10/enNextZX.rom.dis", page: 3 });
  });
});

describe("formatRomSidecar", () => {
  it("is idempotent and sorts entries by offset", () => {
    const messy = {
      provenance: { "0:16:label": "observed", "0:4:label": "manual" },
      banks: {
        "0": {
          localLabels: [
            { value: 16, name: "B" },
            { value: 4, name: "A" }
          ],
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
          offsetIndex: 0
        }
      },
      machine: "rom",
      schemaVersion: 3
    };
    const once = formatRomSidecar(messy);
    expect(formatRomSidecar(JSON.parse(once))).toBe(once);
    expect(once.indexOf('"A"')).toBeLessThan(once.indexOf('"B"'));
    expect(once.indexOf('"schemaVersion"')).toBeLessThan(once.indexOf('"banks"'));
    expect(once.indexOf('"0:4:label"')).toBeLessThan(once.indexOf('"0:16:label"'));
  });
});
