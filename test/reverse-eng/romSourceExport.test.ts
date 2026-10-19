import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import type { AssembledText } from "@common/messaging/MainApi";
import { knownRomPageKind, romPageIdentity } from "@common/roms/romIdentity";
import { parseAnnotations, type ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import {
  buildRomSourceExport,
  compareRomAssembly,
  type RomExportPage
} from "@renderer/appIde/annotations/romSourceExport";

/*
 * The ROM annotation editor's "Export as source": a whole ROM sidecar exported as one Klive Z80
 * file, which must assemble — with Klive's own assembler — to the ROM image byte for byte.
 */

const ROMS = join(__dirname, "../../src/public/roms");

async function assemble(source: string): Promise<AssembledText> {
  const output = await new Z80Assembler().compile(source, new AssemblerOptions());
  return {
    errors: output.errors.map((e) => ({ line: e.line, message: e.message, isWarning: e.isWarning })),
    segments: output.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: [...s.emittedCode] }))
  };
}

function shipped(rom: string): { annotations: ProgramAnnotations; pages: RomExportPage[] } {
  const parsed = parseAnnotations(readFileSync(join(ROMS, `${rom}.dis`), "utf8"));
  const bytes = new Uint8Array(readFileSync(join(ROMS, rom)));
  return {
    annotations: parsed.annotations!,
    pages: [{ page: 0, bytes, kind: knownRomPageKind(romPageIdentity(bytes)), crc32: romPageIdentity(bytes).crc32 }]
  };
}

describe("ROM source export", () => {
  for (const rom of ["sp48.rom", "zx81.rom", "zx80.rom"]) {
    it(`${rom} reassembles to the ROM byte for byte`, async () => {
      const { annotations, pages } = shipped(rom);
      const exported = await buildRomSourceExport(annotations, pages, { header: ["test"] });
      expect(exported.text).toContain(".org $0000");
      const verdict = compareRomAssembly(exported.pages, await assemble(exported.text));
      expect(verdict).toEqual({ kind: "identical", bytes: pages[0].bytes.length });
    }, 60_000);
  }

  it("keeps the annotations' names and comments", async () => {
    const { annotations, pages } = shipped("sp48.rom");
    const { text } = await buildRomSourceExport(annotations, pages);
    const label = annotations.banks["0"].localLabels![0];
    expect(text).toMatch(new RegExp(`^${label.name}:`, "m"));
  }, 60_000);

  it("puts each page of a multi-page ROM in its own module", async () => {
    const page = (n: number) => {
      const bytes = new Uint8Array(0x4000);
      bytes.set([0x3e, n, 0xc3, 0x00, 0x00]); // Start: ld a,n / jp Start
      return bytes;
    };
    const annotations = parseAnnotations(
      JSON.stringify({
        schemaVersion: 3,
        machine: "rom",
        pages: { "0": { crc32: "00000000" }, "1": { crc32: "00000001" } },
        banks: {
          "0": { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: [{ name: "Start", value: 0 }] },
          "1": { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: [{ name: "Start", value: 0 }] }
        }
      })
    ).annotations!;
    const pages = [{ page: 1, bytes: page(1) }, { page: 0, bytes: page(0) }];
    const exported = await buildRomSourceExport(annotations, pages);
    expect(exported.pages.map((p) => p.page)).toEqual([0, 1]);
    expect(exported.text).toContain(".module");
    expect(compareRomAssembly(exported.pages, await assemble(exported.text))).toEqual({ kind: "identical", bytes: 0x8000 });
  }, 60_000);

  it("reports the first differing bytes", () => {
    const pages = [{ page: 0, bytes: new Uint8Array([1, 2, 3]) }];
    expect(compareRomAssembly(pages, { errors: [], segments: [{ startAddress: 0, emittedCode: [1, 9, 3, 4] }] })).toEqual({
      kind: "different",
      differences: [
        { page: 0, offset: 1, expected: 2, actual: 9 },
        { page: 0, offset: 3, actual: 4 }
      ]
    });
    expect(compareRomAssembly(pages, { errors: [{ line: 3, message: "bad" }], segments: [] })).toEqual({
      kind: "notAssembled",
      line: 3,
      message: "bad"
    });
  });
});
