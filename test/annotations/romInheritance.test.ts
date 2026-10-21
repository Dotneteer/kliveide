import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatRomSidecar } from "@common/roms/romAnnotationTools";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { inheritsOf, withInheritedEntries } from "@renderer/appIde/annotations/romInheritance";
import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";

/*
 * A ROM sidecar that `inherits` another is judged as the page it describes: its own entries over the
 * inherited sidecar's byte-bound ones (`romInheritance.ts`). The 128K's ROM 1 is the case it exists
 * for: it is the 48K ROM with six small patches and new code where the 48K has its filler.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (file: string) => new Uint8Array(readFileSync(join(ROMS, file))).subarray(0, 0x4000);
const SP128_1 = rom("sp128-1.rom");
const source = async (sidecar: string, page: number) => ({
  annotations: parseAnnotations(readFileSync(join(ROMS, sidecar), "utf8")).annotations!,
  bytes: rom(sidecar.replace(/\.dis$/, "")).subarray(page * 0x4000, (page + 1) * 0x4000)
});

/** A ROM 1 sidecar with nothing of its own but a label on the first new routine. */
const ROM1_TEXT = formatRomSidecar({
  schemaVersion: 3,
  machine: "rom",
  source: { fileName: "sp128-1.rom" },
  level: 0,
  inherits: [{ sidecar: "sp48.rom.dis", page: 0 }],
  pages: { "0": { crc32: "b96a36be", name: "ZX Spectrum 128K ROM 1" } },
  banks: {
    "0": {
      offsetIndex: 0,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [{ name: "MINE", value: 0x386e }],
      lineAnnotations: { [0x386e]: { synopsis: "Mine." } }
    }
  },
  provenance: { "0:14446:label": "observed", "0:14446:line": "observed" }
} as any);

describe("ROM sidecar inheritance", () => {
  it("keeps the inherits a ROM sidecar declares", () => {
    expect(inheritsOf(parseAnnotations(ROM1_TEXT).annotations)).toEqual([{ sidecar: "sp48.rom.dis", page: 0 }]);
  });

  it("lays the inherited entries whose bytes match under the sidecar's own", async () => {
    const { annotations, missing } = await withInheritedEntries(
      parseAnnotations(ROM1_TEXT).annotations!,
      () => SP128_1,
      source
    );
    expect(missing).toEqual([]);
    const labels = annotations.banks["0"].localLabels!;
    const names = new Map(labels.map((label) => [label.value, label.name]));
    expect(names.get(0x386e)).toBe("MINE"); // --- its own, where the 48K's filler label was
    expect(names.get(0x3d00)).toBe("CHARACTER_SET"); // --- inherited: the same bytes
    expect(names.has(0x1b7d)).toBe(false); // --- a patched routine loses its inherited label
    expect(labels.length).toBeGreaterThan(1000);
    // --- The inherited data regions apply where their bytes match; the 48K's filler does not
    const data = annotations.banks["0"].regions.filter((r) => r.type !== "disassemble").map((r) => r.start);
    expect(data).toContain(0x3d00);
    expect(data).not.toContain(0x386e);
  });

  it("is measured with what it inherits, and says when that cannot be read", async () => {
    const check = await checkRomSidecar(ROM1_TEXT, () => SP128_1, source);
    expect(check.problems).toEqual([]);
    // --- Only the patched routines' and the new code's targets are left to label
    expect(check.unlabelledTargets["0"].length).toBeLessThan(100);
    expect(check.unlabelledTargets["0"]).toContain(0x1b7d);

    const unread = await checkRomSidecar(ROM1_TEXT, () => SP128_1);
    expect(unread.problems).toEqual([expect.stringContaining("cannot read")]);
    const missing = await checkRomSidecar(ROM1_TEXT, () => SP128_1, async () => undefined);
    expect(missing.problems).toEqual([expect.stringContaining("sp48.rom.dis")]);
  });
});
