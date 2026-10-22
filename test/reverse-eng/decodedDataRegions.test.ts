import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { compareAssembly, exportSource, kliveDialect } from "@common/reverse/sourceExport";
import { skoolDefm } from "@common/reverse/skool/annotationsToSkool";
import { REGION_BLOCK } from "@common/reverse/skool/skoolToAnnotations";
import {
  decodedRegionTypesFor,
  parseAnnotations,
  toSidecarRegion,
  type ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import { createAnnotatedDisassemblyItems, defcLiteralChar } from "@renderer/appIde/annotations/annotatedDisassembly";
import { regionTypeOfAction } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";
import { bankContentMix } from "@renderer/appIde/DocumentPanels/Next/nexBankSummary";

/*
 * Decoded data regions stored as `bytes` + `decode`: `defc` (ASCII strings each ended by bit 7 set
 * on the last character, the ZX Spectrum ROMs' keyword and message tables, listed as `.defc` rows)
 * and `fill` (runs of one repeated byte, listed as `.fillb` rows). Both reassemble to the same bytes.
 */

function sidecar(regions: object[], localLabels: object[] = [], machine = "sp48"): ProgramAnnotations {
  const result = parseAnnotations(
    JSON.stringify({ schemaVersion: 3, machine, banks: { "2": { offsetIndex: 2, regions, localLabels } } })
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return result.annotations!;
}

async function rows(contents: Uint8Array, annotations: ProgramAnnotations, end: number) {
  const items = (await createAnnotatedDisassemblyItems({
    annotations,
    bank: 2,
    contents,
    allowExtendedSet: false,
    range: { start: 0, end }
  }))!;
  return items.filter((i) => !i.isPrefixItem).map((i) => i.instruction);
}

describe("defc regions", () => {
  it("are stored as bytes + decode and read back", () => {
    const annotations = sidecar([
      { start: 0, end: 9, type: "bytes", decode: "defc" },
      { start: 10, end: 0x3fff, type: "bytes" }
    ]);
    const region = annotations.banks["2"].regions[0];
    expect(region.type).toBe("defc");
    expect(toSidecarRegion(region)).toEqual({ start: 0, end: 9, type: "bytes", decode: "defc" });
  });

  it("are offered on every machine but the ZX80 and ZX81", () => {
    expect(decodedRegionTypesFor("sp48")).toContain("defc");
    expect(decodedRegionTypesFor("next")).toContain("defc");
    expect(decodedRegionTypesFor("rom")).toContain("defc");
    expect(decodedRegionTypesFor("zx81")).not.toContain("defc");
    expect(decodedRegionTypesFor("zx80")).not.toContain("defc");
    const result = parseAnnotations(
      JSON.stringify({
        schemaVersion: 3,
        machine: "zx81",
        banks: { "0": { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "bytes", decode: "defc" }] } }
      })
    );
    expect(result.annotations!.banks["0"].regions[0].type).toBe("bytes");
    expect(result.diagnostics.map((d) => d.message)).toContain("decode defc does not apply to this machine; listed as bytes.");
  });

  it("list one .defc row per string", async () => {
    const contents = new Uint8Array(0x4000);
    // --- "?" , "RND", a lone $80, "A<CR>B", a quote, "CLS", then an unterminated "XY"
    contents.set([0xbf, 0x52, 0x4e, 0xc4, 0x80, 0x41, 0x0d, 0xc2, 0xa2, 0x43, 0x4c, 0xd3, 0x58, 0x59], 0);
    const annotations = sidecar([
      { start: 0, end: 13, type: "bytes", decode: "defc" },
      { start: 14, end: 0x3fff, type: "bytes" }
    ]);
    expect((await rows(contents, annotations, 13)).slice(0, 7)).toEqual([
      '.defc "?"',
      '.defc "RND"',
      '.defc "\\x00"',
      '.defc "A\\x0DB"',
      '.defc "\\x22"',
      '.defc "CLS"',
      '.defm "XY"'
    ]);
  });

  it("cut a string at a label inside it", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0x45, 0x52, 0x52, 0x4f, 0xd2, 0x2c, 0xa0], 0); // "ERRO" + "R"|$80, "," + " "|$80
    const annotations = sidecar(
      [
        { start: 0, end: 6, type: "bytes", decode: "defc" },
        { start: 7, end: 0x3fff, type: "bytes" }
      ],
      [{ name: "Last", value: 4 }]
    );
    expect((await rows(contents, annotations, 6)).slice(0, 3)).toEqual(['.defm "ERRO"', '.defc "R"', '.defc ", "']);
  });

  it("list a byte with no literal form as .defb", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0x41, 0x5c, 0xc2], 0); // "A", a backslash, "B"|$80
    const annotations = sidecar([
      { start: 0, end: 2, type: "bytes", decode: "defc" },
      { start: 3, end: 0x3fff, type: "bytes" }
    ]);
    expect((await rows(contents, annotations, 2)).slice(0, 3)).toEqual(['.defm "A"', ".defb $5C", '.defc "B"']);
    expect(defcLiteralChar(0x5c)).toBeUndefined();
  });

  it("export as source and reassemble byte for byte, for every byte value", async () => {
    // --- Every value as a string's last byte, and as a byte inside one: 128 three-byte strings
    // --- "A", c, "A"|$80 and 128 one-byte strings c|$80, then each of the 256 values on its own
    const bytes = new Uint8Array(0x4000);
    let at = 0;
    for (let c = 0; c < 0x80; c++) bytes.set([0x41, c, 0xc1], (at += 3) - 3);
    for (let c = 0; c < 0x80; c++) bytes[at++] = c | 0x80;
    for (let c = 0; c < 0x100; c++) bytes[at++] = c;
    const end = at - 1;
    const annotations = sidecar([
      { start: 0, end, type: "bytes", decode: "defc" },
      { start: end + 1, end: 0x3fff, type: "bytes" }
    ]);
    const result = await exportSource({
      annotations,
      bank: 2,
      bytes,
      listingBase: 0x8000,
      range: { start: 0, end },
      z80n: false
    });
    const source = kliveDialect.render(result.lines);
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    expect(output.errors.filter((e) => !e.isWarning).map((e) => e.message)).toEqual([]);
    expect(compareAssembly(result.expected, output.segments)).toEqual({ identical: true, differences: [] });
    expect(source).toContain('.defc "ARA"');
    expect(source).toContain('.defc "\\x00"');
  });

  it("export to SkoolKit as DEFM with +128", () => {
    expect(skoolDefm([0x41, 0x42, 0xc3])).toBe('DEFM "AB","C"+128');
    expect(skoolDefm([0xbf])).toBe('DEFM "?"+128');
    expect(skoolDefm([0x41, 0x42])).toBe('DEFM "AB"');
    expect(skoolDefm([0x41, 0x0d, 0xc2])).toBeUndefined();
    expect(skoolDefm([0xa2])).toBeUndefined();
    expect(REGION_BLOCK.defc).toBe("t");
  });

  it("are a menu action, and text in a bank's content mix", () => {
    expect(regionTypeOfAction("mark-defc")).toBe("defc");
    const mix = bankContentMix([
      { start: 0, end: 9, type: "defc" },
      { start: 10, end: 19, type: "text" },
      { start: 20, end: 0x3fff, type: "bytes" }
    ]);
    expect(mix.text).toBe(20);
    expect(mix.defc).toBe(0);
  });
});

describe("SkoolKit DEFM lists", () => {
  it("become .defb for the Klive assembler", async () => {
    const { skoolDataToKlive } = await import("@common/reverse/skool/skoolToAnnotations");
    expect(skoolDataToKlive('DEFM "AB","C"+128')).toBe(".defb $41,$42,$C3");
    expect(skoolDataToKlive('DEFM "?"+128')).toBe(".defb $BF");
    expect(skoolDataToKlive('DEFB "A,B",13,$80')).toBe(".defb $41,$2C,$42,$0D,$80");
    expect(skoolDataToKlive('DEFM "Hi"')).toBe(".defb $48,$69");
    expect(skoolDataToKlive("DEFB 1,2")).toBe("DEFB 1,2");
    expect(skoolDataToKlive('DEFM "A"+N')).toBe('DEFM "A"+N');
    expect(skoolDataToKlive("LD A,1")).toBe("LD A,1");
    const output = await new Z80Assembler().compile(`  .org $8000\n  ${skoolDataToKlive('DEFM "AB","C"+128')}\n`, new AssemblerOptions());
    expect(output.segments.flatMap((s) => s.emittedCode)).toEqual([0x41, 0x42, 0xc3]);
  });
});

describe("fill regions", () => {
  const contents = () => {
    const bytes = new Uint8Array(0x4000);
    bytes.set([0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x07, 0xff, 0xff, 0xff], 0);
    return bytes;
  };
  const annotations = () =>
    sidecar(
      [
        { start: 0, end: 10, type: "bytes", decode: "fill" },
        { start: 11, end: 0x3fff, type: "bytes" }
      ],
      [{ name: "Mid", value: 3 }]
    );

  it("are stored as bytes + decode and offered everywhere", () => {
    const region = annotations().banks["2"].regions[0];
    expect(region.type).toBe("fill");
    expect(toSidecarRegion(region)).toEqual({ start: 0, end: 10, type: "bytes", decode: "fill" });
    for (const machine of ["sp48", "next", "rom", "zx81", "zx80"] as const) {
      expect(decodedRegionTypesFor(machine)).toContain("fill");
    }
    expect(regionTypeOfAction("mark-fill")).toBe("fill");
  });

  it("list one .fillb row per run, cut at labels", async () => {
    expect((await rows(contents(), annotations(), 10)).slice(0, 5)).toEqual([
      ".fillb 3,$FF",
      ".fillb 2,$FF",
      ".fillb 2,$00",
      ".defb $07",
      ".fillb 3,$FF"
    ]);
  });

  it("export as source and reassemble byte for byte", async () => {
    const bytes = new Uint8Array(0x4000).fill(0xff);
    bytes.set([1, 2, 2, 3], 0x100);
    const result = await exportSource({
      annotations: sidecar([
        { start: 0, end: 0x3fff, type: "bytes", decode: "fill" }
      ]),
      bank: 2,
      bytes,
      listingBase: 0x8000,
      range: { start: 0, end: 0x3fff },
      z80n: false
    });
    const source = kliveDialect.render(result.lines);
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    expect(output.errors.filter((e) => !e.isWarning).map((e) => e.message)).toEqual([]);
    expect(compareAssembly(result.expected, output.segments)).toEqual({ identical: true, differences: [] });
    expect(source).toContain(".fillb 256,$FF");
    expect(source).toContain(".fillb 16124,$FF");
    expect(source.split("\n").filter((line) => line.trim()).length).toBeLessThan(20);
  });

  it("go to SkoolKit as DEFS size,value and come back as .fillb", async () => {
    const { skoolDataToKlive } = await import("@common/reverse/skool/skoolToAnnotations");
    expect(REGION_BLOCK.fill).toBe("s");
    expect(skoolDataToKlive("DEFS 1170,$FF")).toBe(".fillb 1170,$FF");
    expect(skoolDataToKlive("DEFS 10")).toBe("DEFS 10");
    const output = await new Z80Assembler().compile(`  .org $8000\n  ${skoolDataToKlive("DEFS 3,$FF")}\n`, new AssemblerOptions());
    expect(output.segments.flatMap((s) => s.emittedCode)).toEqual([0xff, 0xff, 0xff]);
  });

  it("count as bytes in a bank's content mix", () => {
    const mix = bankContentMix([
      { start: 0, end: 9, type: "fill" },
      { start: 10, end: 0x3fff, type: "bytes" }
    ]);
    expect(mix.bytes).toBe(0x4000);
    expect(mix.fill).toBe(0);
  });
});

describe("the live Disassembly row menu", () => {
  it("offers every region kind the machine supports, in the region dialog's order", async () => {
    const { regionActionsFor } = await import("@renderer/appIde/annotations/useLiveAnnotationEditing");
    const { nextBankSpace, sp48BankSpace } = await import("@common/annotations/bankSpace");
    expect(regionActionsFor(sp48BankSpace).map((a) => a.id)).toEqual([
      "mark-disassembly", "mark-bytes", "mark-words", "mark-text", "mark-defc", "mark-fill", "mark-skip"
    ]);
    expect(regionActionsFor(nextBankSpace).map((a) => a.id)).toEqual([
      "mark-disassembly", "mark-bytes", "mark-words", "mark-text", "mark-defc", "mark-fill", "mark-skip", "mark-copper", "mark-dma"
    ]);
    expect(regionActionsFor(sp48BankSpace).find((a) => a.id === "mark-fill")?.text).toBe("Mark As Fill (.fillb)");
  });
});
