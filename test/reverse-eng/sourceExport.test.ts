import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { compareAssembly, exportSource, isAssemblableName, kliveDialect } from "@common/reverse/sourceExport";
import { parseAnnotations, type ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

/*
 * Export as source (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7, §8 G7.6): every region type,
 * names, externals and skip modes — and the round trip on real bytes: export, assemble with
 * Klive's own assembler, get the same bytes.
 */

async function assemble(source: string, model?: number) {
  const options = new AssemblerOptions();
  if (model !== undefined) options.currentModel = model;
  const output = await new Z80Assembler().compile(source, options);
  return output;
}

function annotationsOf(json: object): ProgramAnnotations {
  const result = parseAnnotations(JSON.stringify(json));
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return result.annotations!;
}

const bank2 = () => {
  const bytes = new Uint8Array(0x4000);
  bytes.set(
    [
      0x21, 0x40, 0x80, // 0: ld hl,Table
      0xcd, 0x00, 0x30, // 3: call $3000 (outside the range)
      0xed, 0x4c, // 6: neg (non-canonical)
      0xdd, 0x00, // 8: prefix with no effect
      0xed, 0x63, 0x00, 0x90, // 10: ld ($9000),hl the long way
      0x10, 0xfe, // 14: djnz $800E
      0xc3, 0x00, 0x80 // 16: jp Start
    ],
    0
  );
  bytes.set([0x00, 0x80, 0x10, 0x80], 0x40); // Table: .defw
  bytes.set([0x48, 0x69, 0x22, 0x5c, 0xa1, 0x00], 0x50); // text with a quote, a backslash, bit 7
  bytes.set([0x3c, 0x42, 0x81, 0xff], 0x60); // a graphic
  bytes.set([1, 2, 3, 4, 5], 0x70); // a skip region
  bytes.set([0x21, 0x00], 0x7e); // ld hl,nn that runs past its region (0x7e..0x7f)
  return bytes;
};

const ANNOTATIONS = {
  schemaVersion: 3,
  machine: "sp48",
  globalLabels: [{ name: "Far", value: 0x3000 }],
  banks: {
    "2": {
      offsetIndex: 2,
      regions: [
        { start: 0, end: 0x3f, type: "disassemble" },
        { start: 0x40, end: 0x43, type: "words" },
        { start: 0x44, end: 0x4f, type: "bytes" },
        { start: 0x50, end: 0x55, type: "bytes", decode: "text" },
        { start: 0x56, end: 0x5f, type: "bytes" },
        { start: 0x60, end: 0x63, type: "bytes", rowBytes: 1, decode: "graphic" },
        { start: 0x64, end: 0x6f, type: "bytes" },
        { start: 0x70, end: 0x74, type: "skip" },
        { start: 0x75, end: 0x7d, type: "bytes" },
        { start: 0x7e, end: 0x7f, type: "disassemble" },
        { start: 0x80, end: 0x3fff, type: "bytes" }
      ],
      localLabels: [
        { name: "Start", value: 0 },
        { name: "hl", value: 6 },
        { name: "Table", value: 0x40 },
        { name: "table", value: 0x50 },
        { name: "Ship", value: 0x60 }
      ],
      lineAnnotations: {
        "0": { synopsis: "The entry point.\nCalled once.", comment: "point at the table" },
        "16": { endComment: "Never returns." }
      },
      graphics: [{ offset: 0x60, width: 1, height: 4, count: 1, layout: "linear", label: "Ship" }],
      comment: "Bank 2 of the test program."
    }
  }
};

describe("exportSource", () => {
  it("round-trips a 48K bank byte for byte", async () => {
    const bytes = bank2();
    const result = await exportSource({
      annotations: annotationsOf(ANNOTATIONS),
      bank: 2,
      bytes,
      listingBase: 0x8000,
      range: { start: 0, end: 0xff },
      z80n: false,
      header: ["Exported for a test"]
    });
    const source = kliveDialect.render(result.lines);
    const output = await assemble(source);
    expect(output.errors.filter((e) => !e.isWarning).map((e) => e.message)).toEqual([]);
    expect(compareAssembly(result.expected, output.segments)).toEqual({ identical: true, differences: [] });

    // --- What made it safe to assemble
    expect(source).toContain("; Exported for a test");
    expect(source).toContain("; Bank 2 of the test program.");
    expect(source).toContain("Far .equ $3000");
    expect(source).toContain(".defb $ED,$4C");
    expect(source).toMatch(/\.defb \$DD,\$00\s+; nop \(prefix has no effect\)/);
    expect(source).toContain("; The entry point.");
    expect(source).toContain("; Never returns.");
    expect(source).toMatch(/Start:\s+ld hl,Table\s+; point at the table/);
    expect(source).toMatch(/L_hl:/);
    expect(source).toMatch(/table_2:/);
    expect(source).toMatch(/Ship:\s+\.defb %00111100\s+; \.\.####\.\./);
    expect(source).toMatch(/\.defb \$01,\$02,\$03,\$04,\$05\s+; skip region/);
    expect(result.notes).toContain("The label hl is exported as L_hl.");
  });

  it("leaves a skip region out with -skip gap, and says so", async () => {
    const result = await exportSource({
      annotations: annotationsOf(ANNOTATIONS),
      bank: 2,
      bytes: bank2(),
      listingBase: 0x8000,
      range: { start: 0x60, end: 0x7d },
      z80n: false,
      skip: "gap"
    });
    const source = kliveDialect.render(result.lines);
    expect(source).toContain(".org $8075");
    const output = await assemble(source);
    expect(compareAssembly(result.expected, output.segments).identical).toBe(true);
    expect(result.notes.some((n) => n.includes("fewer bytes"))).toBe(true);
  });

  it("round-trips a 128K bank with .bank", async () => {
    const bytes = new Uint8Array(0x4000);
    bytes.set([0x3e, 0x07, 0xd3, 0xfe, 0xc9], 0);
    const result = await exportSource({
      annotations: annotationsOf({ schemaVersion: 3, machine: "sp128", banks: { "1": { offsetIndex: 3, regions: [] } } }),
      bank: 1,
      bytes,
      listingBase: 0xc000,
      range: { start: 0, end: 0x0f },
      z80n: false,
      model: "Spectrum128",
      bankDirective: 1
    });
    const output = await assemble(kliveDialect.render(result.lines), SpectrumModelType.Spectrum128);
    expect(output.errorCount).toBe(0);
    expect(output.segments[0].bank).toBe(1);
    expect(compareAssembly(result.expected, output.segments).identical).toBe(true);
  });

  it("round-trips a Next bank with Next opcodes and a Copper list", async () => {
    const bytes = new Uint8Array(0x4000);
    bytes.set([0xed, 0x91, 0x07, 0x03, 0xed, 0x27, 0x0f, 0xed, 0x8a, 0x12, 0x34, 0xc9], 0);
    bytes.set([0x80, 0x00, 0xff, 0xff], 0x20);
    const result = await exportSource({
      annotations: annotationsOf({
        schemaVersion: 2,
        banks: {
          "20": {
            offsetIndex: 3,
            regions: [
              { start: 0, end: 0x1f, type: "disassemble" },
              { start: 0x20, end: 0x23, type: "bytes", rowBytes: 2, decode: "copper" }
            ]
          }
        }
      }),
      bank: 20,
      bytes,
      listingBase: 0xc000,
      range: { start: 0, end: 0x2f },
      z80n: true,
      model: "next"
    });
    const source = kliveDialect.render(result.lines);
    expect(source).toContain("nextreg $07,$03");
    const output = await assemble(source);
    expect(output.errors.filter((e) => !e.isWarning).map((e) => e.message)).toEqual([]);
    expect(compareAssembly(result.expected, output.segments).identical).toBe(true);
  });

  it("reports the first differing addresses", () => {
    expect(
      compareAssembly([{ address: 0x8000, bytes: [1, 2, 3] }], [{ startAddress: 0x8000, emittedCode: [1, 9] }])
    ).toEqual({
      identical: false,
      differences: [
        { address: 0x8001, expected: 2, actual: 9 },
        { address: 0x8002, expected: 3 }
      ]
    });
  });

  it("knows which names the assembler takes", () => {
    expect(isAssemblableName("Loop")).toBe(true);
    expect(isAssemblableName("hl")).toBe(false);
    expect(isAssemblableName("LD")).toBe(false);
    expect(isAssemblableName("org")).toBe(false);
    expect(isAssemblableName("9lives")).toBe(false);
  });
});
