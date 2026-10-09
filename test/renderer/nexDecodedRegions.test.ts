import { describe, expect, it, vi } from "vitest";

import {
  parseAnnotations,
  toSidecarRegion,
  validateAnnotations,
  type AnnotationRegion,
  type ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import {
  formatAnnotations,
  saveAnnotationSubtree
} from "@renderer/appIde/annotations/annotationSidecar";
import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import {
  dmaTrimSuggestion,
  formatRegionPreview,
  regionHint,
  validateRegion
} from "@renderer/appIde/DocumentPanels/Next/NexRegionDialog";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * Copper and DMA regions (`.plans/NEX_DMA_COPPER_REGIONS_PLAN.md`): the sidecar form that shipped
 * builds can read (D3), the listing rows (D1, D4, D5, D6), and the dialog helpers (D8).
 */

const sidecarWith = (regions: unknown[]) => ({
  schemaVersion: 2,
  banks: { "5": { offsetIndex: 2, regions } }
});

/**
 * The region rules of the build that shipped before these kinds existed, restated: the type is one
 * of the four, `rowBytes` only on `bytes` and in 1..4, `words` even. A sidecar this build writes has
 * to pass them, or a shipped build refuses the whole file.
 */
function previousBuildAccepts(region: Record<string, unknown>): boolean {
  if (!["disassemble", "bytes", "words", "skip"].includes(region.type as string)) return false;
  if (region.rowBytes !== undefined) {
    if (region.type !== "bytes") return false;
    if (!Number.isInteger(region.rowBytes) || (region.rowBytes as number) < 1 || (region.rowBytes as number) > 4) {
      return false;
    }
  }
  const length = (region.end as number) - (region.start as number) + 1;
  return region.type !== "words" || length % 2 === 0;
}

async function assemble(source: string): Promise<number[]> {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  const result = await new Z80Assembler().compile(source, opts);
  if (result.errorCount > 0) {
    throw new Error(`${result.errors.map((e) => `${e.errorCode} ${e.message}`).join("; ")}\n${source}`);
  }
  return result.segments.flatMap((s) => [...s.emittedCode]);
}

// ---------------------------------------------------------------------------------------------
// Phase 2: the sidecar

describe("decoded regions in the sidecar (D3)", () => {
  it("reads bytes + decode as Copper and DMA regions", () => {
    const result = validateAnnotations(
      sidecarWith([
        { start: 0x1000, end: 0x103f, type: "bytes", rowBytes: 2, decode: "copper" },
        { start: 0x1040, end: 0x105f, type: "bytes", decode: "dma" }
      ])
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.annotations!.banks["5"].regions).toEqual([
      { start: 0, end: 0x0fff, type: "disassemble" },
      { start: 0x1000, end: 0x103f, type: "copper" },
      { start: 0x1040, end: 0x105f, type: "dma" },
      { start: 0x1060, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("writes them back as bytes + decode, never as a new type", () => {
    expect(toSidecarRegion({ start: 0, end: 63, type: "copper" })).toEqual({
      start: 0,
      end: 63,
      type: "bytes",
      rowBytes: 2,
      decode: "copper"
    });
    expect(toSidecarRegion({ start: 64, end: 77, type: "dma" })).toEqual({
      start: 64,
      end: 77,
      type: "bytes",
      decode: "dma"
    });
    expect(toSidecarRegion({ start: 0, end: 7, type: "bytes", rowBytes: 2 })).toEqual({
      start: 0,
      end: 7,
      type: "bytes",
      rowBytes: 2
    });
  });

  const model: ProgramAnnotations = {
    schemaVersion: 2,
    banks: {
      "5": {
        offsetIndex: 2,
        regions: [
          { start: 0, end: 0x0fff, type: "disassemble" },
          { start: 0x1000, end: 0x103f, type: "copper" },
          { start: 0x1040, end: 0x104d, type: "dma" },
          { start: 0x104e, end: 0x3fff, type: "disassemble" }
        ]
      }
    }
  };

  it("round-trips through the file", () => {
    const text = formatAnnotations(model);
    expect(text).not.toMatch(/"type": "(copper|dma)"/);
    const parsed = parseAnnotations(text);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.annotations!.banks["5"].regions).toEqual(model.banks["5"].regions);
    // --- The in-memory model is not touched by writing it
    expect(model.banks["5"].regions[1].type).toBe("copper");
  });

  it("writes a file the previous build accepts", () => {
    const written = JSON.parse(formatAnnotations(model));
    for (const region of written.banks["5"].regions) {
      expect(previousBuildAccepts(region), JSON.stringify(region)).toBe(true);
    }
  });

  it("writes the stored form through the subtree writer too", async () => {
    const saved: string[] = [];
    const projectService = {
      readFileContent: vi.fn(() => Promise.resolve(JSON.stringify({ debug: { breakpoints: [] } }))),
      saveFileContent: vi.fn((_path: string, contents: string) => {
        saved.push(contents);
        return Promise.resolve();
      })
    };
    await saveAnnotationSubtree(projectService as any, "/p/game.nex.dis", model);
    const written = JSON.parse(saved[0]);
    expect(written.debug).toEqual({ breakpoints: [] });
    expect(written.banks["5"].regions[1]).toEqual({
      start: 0x1000,
      end: 0x103f,
      type: "bytes",
      rowBytes: 2,
      decode: "copper"
    });
    expect(written.banks["5"].regions[2]).toEqual({
      start: 0x1040,
      end: 0x104d,
      type: "bytes",
      decode: "dma"
    });
  });

  it("warns about an unknown decode and keeps the file", () => {
    const result = validateAnnotations(
      sidecarWith([{ start: 0, end: 7, type: "bytes", decode: "sprites" }])
    );
    expect(result.annotations).toBeDefined();
    expect(result.annotations!.banks["5"].regions[0]).toEqual({ start: 0, end: 7, type: "bytes" });
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        path: "$.banks.5.regions[0].decode",
        message: "decode is not supported; listed as bytes."
      }
    ]);
  });

  it("warns about decode on a region that is not bytes, and ignores it", () => {
    const result = validateAnnotations(
      sidecarWith([{ start: 0, end: 7, type: "words", decode: "copper" }])
    );
    expect(result.annotations!.banks["5"].regions[0].type).toBe("words");
    expect(result.diagnostics[0].severity).toBe("warning");
  });

  it("loads an odd Copper region with a warning", () => {
    const result = validateAnnotations(
      sidecarWith([{ start: 0, end: 6, type: "bytes", rowBytes: 2, decode: "copper" }])
    );
    expect(result.annotations!.banks["5"].regions[0]).toEqual({ start: 0, end: 6, type: "copper" });
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        path: "$.banks.5.regions[0]",
        message: "Copper regions should contain an even number of bytes."
      }
    ]);
  });

  it("never merges a Copper region with a neighbouring two-byte bytes region", () => {
    const result = validateAnnotations(
      sidecarWith([
        { start: 0, end: 7, type: "bytes", rowBytes: 2 },
        { start: 8, end: 15, type: "bytes", rowBytes: 2, decode: "copper" }
      ])
    );
    expect(result.annotations!.banks["5"].regions.slice(0, 2)).toEqual([
      { start: 0, end: 7, type: "bytes", rowBytes: 2 },
      { start: 8, end: 15, type: "copper" }
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 3: the listing

type Labels = { global?: { name: string; value: number }[]; local?: { name: string; value: number }[] };

async function listing(
  type: "copper" | "dma",
  data: number[],
  opts: { labels?: Labels; decimalView?: boolean; end?: number; contents?: Uint8Array } = {}
) {
  const contents = opts.contents ?? new Uint8Array(0x4000);
  if (!opts.contents) contents.set(data);
  const end = opts.end ?? data.length - 1;
  const regions: AnnotationRegion[] = [
    { start: 0, end, type },
    { start: end + 1, end: 0x3fff, type: "skip" }
  ];
  const items = await createAnnotatedDisassemblyItems({
    annotations: {
      schemaVersion: 2,
      globalLabels: opts.labels?.global ?? [],
      banks: { "2": { offsetIndex: 2, regions, localLabels: opts.labels?.local ?? [] } }
    },
    bank: 2,
    contents,
    disassOffset: 0x8000,
    decimalView: opts.decimalView
  });
  return items!
    .filter((item) => !item.instruction?.startsWith(".skip"))
    .map((item) => ({
      address: item.address,
      label: item.formattedLabel,
      instruction: item.instruction,
      comment: item.hardComment,
      byteLength: item.annotation?.byteLength,
      regionType: item.annotation?.regionType
    }));
}

/** The listing as source, with its labels, ready for the assembler. */
const asSource = (rows: { label?: string; instruction?: string }[]) =>
  rows.map((r) => `${r.label ? `${r.label}:` : ""}  ${r.instruction}`).join("\n");

const SPLIT_SCREEN_COPPER = [
  0x80, 0x00, // wait 0, 0
  0x41, 0x1c, // move $41, $1C
  0x86, 0x60, // wait 96, 3
  0x41, 0xe0, // move $41, $E0
  0x00, 0x00, // nop
  0x00, 0x12, // nop with a value
  0xff, 0xff // halt
];

const DMA_PROGRAM = [
  0xc3, // reset
  0x7d, 0x00, 0x40, 0x20, 0x00, // wr0 a_to_b, transfer, $4000, 32
  0x14, // wr1 memory, increment
  0x10, // wr2 memory, increment
  0xad, 0x00, 0x48, // wr4 continuous, $4800
  0x82, // wr5
  0xcf, // load
  0x87 // enable
];

describe("Copper listing", () => {
  it("lists one .copper row per word, with its meaning", async () => {
    const rows = await listing("copper", SPLIT_SCREEN_COPPER);
    expect(rows.map((r) => r.instruction)).toEqual([
      ".copper wait 0, 0",
      ".copper move $41, $1C",
      ".copper wait 96, 3",
      ".copper move $41, $E0",
      ".copper nop",
      ".copper word $0012",
      ".copper halt"
    ]);
    expect(rows.every((r) => r.byteLength === 2 && r.regionType === "copper")).toBe(true);
    expect(rows[0].comment).toBe("line 0 · x 0");
    expect(rows[1].comment).toMatch(/← \$1C/);
    expect(rows[5].comment).toBe("NOP (value $12 ignored)");
    expect(await assemble(asSource(rows))).toEqual(SPLIT_SCREEN_COPPER);
  });

  it("keeps WAIT decimal and lists MOVE in decimal in the decimal view", async () => {
    const rows = await listing("copper", SPLIT_SCREEN_COPPER, { decimalView: true });
    expect(rows[1].instruction).toBe(".copper move 65, 28");
    expect(rows[2].instruction).toBe(".copper wait 96, 3");
    expect(rows[5].instruction).toBe(".copper word 18");
    expect(await assemble(asSource(rows))).toEqual(SPLIT_SCREEN_COPPER);
  });

  it("never splits a word at a label on its second byte (D5)", async () => {
    const rows = await listing("copper", SPLIT_SCREEN_COPPER, {
      labels: { global: [{ name: "Colour", value: 0x8003 }, { name: "Second", value: 0x8002 }] }
    });
    expect(rows).toHaveLength(7);
    expect(rows[1]).toMatchObject({ label: "Second", instruction: ".copper move $41, $1C" });
  });

  it("lists an odd trailing byte as .defb", async () => {
    const rows = await listing("copper", [0x41, 0x1c, 0x99]);
    expect(rows.map((r) => r.instruction)).toEqual([".copper move $41, $1C", ".defb $99"]);
  });
});

describe("DMA listing", () => {
  it("lists one .dma row per command, with its meaning", async () => {
    const rows = await listing("dma", DMA_PROGRAM);
    expect(rows.map((r) => r.instruction)).toEqual([
      ".dma reset",
      ".dma wr0 a_to_b, transfer, $4000, $0020",
      ".dma wr1 memory, increment",
      ".dma wr2 memory, increment",
      ".dma wr4 continuous, $4800",
      ".dma wr5",
      ".dma load",
      ".dma enable"
    ]);
    expect(rows.map((r) => r.byteLength)).toEqual([1, 5, 1, 1, 3, 1, 1, 1]);
    expect(rows.every((r) => r.regionType === "dma")).toBe(true);
    expect(rows[1].comment).toBe("WR0: A→B transfer, port A $4000, length $0020 (32)");
    expect(await assemble(asSource(rows))).toEqual(DMA_PROGRAM);
  });

  it("lists decimal numbers in the decimal view", async () => {
    const rows = await listing("dma", DMA_PROGRAM, { decimalView: true });
    expect(rows[1].instruction).toBe(".dma wr0 a_to_b, transfer, 16384, 32");
    expect(await assemble(asSource(rows))).toEqual(DMA_PROGRAM);
  });

  it("splits a command at a label on a follow byte into the patching form (D5)", async () => {
    const rows = await listing("dma", DMA_PROGRAM, {
      labels: {
        global: [
          { name: "PORT_A", value: 0x8002 },
          { name: "BLOCK_LEN", value: 0x8004 },
          { name: "PORT_B", value: 0x8009 }
        ]
      }
    });
    expect(rows.slice(1, 4).map((r) => [r.label, r.instruction, r.byteLength])).toEqual([
      [undefined, ".dma wr0 a_to_b, transfer", 1],
      ["PORT_A", ".defw $4000", 2],
      ["BLOCK_LEN", ".defw $0020", 2]
    ]);
    expect(rows[3].comment).toBe("block length");
    expect(rows.slice(6, 8).map((r) => [r.label, r.instruction])).toEqual([
      [undefined, ".dma wr4 continuous"],
      ["PORT_B", ".defw $4800"]
    ]);
    expect(await assemble(asSource(rows))).toEqual(DMA_PROGRAM);
  });

  it("falls back to .defb for a label on the odd byte of a field", async () => {
    const rows = await listing("dma", DMA_PROGRAM, {
      labels: { local: [{ name: "PortAHigh", value: 3 }] }
    });
    expect(rows.slice(1, 6).map((r) => [r.label, r.instruction])).toEqual([
      [undefined, ".dma wr0 a_to_b, transfer"],
      [undefined, ".defb $00"],
      ["PortAHigh", ".defb $40"],
      [undefined, ".defw $0020"],
      [undefined, ".dma wr1 memory, increment"]
    ]);
    expect(await assemble(asSource(rows))).toEqual(DMA_PROGRAM);
  });

  it("splits a command that has no patching form with .dma cmd", async () => {
    const program = [0x68, 0x21, 0x32]; // wr2 io, fixed, 3t, $32
    const rows = await listing("dma", program, { labels: { local: [{ name: "Prescale", value: 2 }] } });
    expect(rows.map((r) => [r.label, r.instruction])).toEqual([
      [undefined, ".dma cmd $68"],
      [undefined, ".defb $21"],
      ["Prescale", ".defb $32"]
    ]);
    expect(await assemble(asSource(rows))).toEqual(program);
  });

  it("lists a command cut off by the region end as .defb (D4)", async () => {
    const rows = await listing("dma", [0xc3, 0x7d, 0x00, 0x40]);
    expect(rows.map((r) => [r.instruction, r.comment])).toEqual([
      [".dma reset", "WR6: reset"],
      [".defb $7D, $00, $40", "truncated: WR0 expects 2 more bytes"]
    ]);
  });

  it("re-decodes the bytes it is given (the live-bank view)", async () => {
    const live = new Uint8Array(0x4000);
    live.set(DMA_PROGRAM);
    live[0] = 0x83; // the program patched its first command to "disable"
    const rows = await listing("dma", DMA_PROGRAM, { contents: live, end: DMA_PROGRAM.length - 1 });
    expect(rows[0].instruction).toBe(".dma disable");
  });

  it("lets a user comment replace the generated meaning", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set(DMA_PROGRAM);
    const items = await createAnnotatedDisassemblyItems({
      annotations: {
        schemaVersion: 2,
        banks: {
          "2": {
            offsetIndex: 2,
            regions: [
              { start: 0, end: DMA_PROGRAM.length - 1, type: "dma" },
              { start: DMA_PROGRAM.length, end: 0x3fff, type: "skip" }
            ],
            lineAnnotations: { "1": { comment: "copy the screen" } }
          }
        }
      },
      bank: 2,
      contents,
      disassOffset: 0x8000
    });
    expect(items![1].hardComment).toBe("copy the screen");
    expect(items![1].annotation?.generatedHardComment).toMatch(/^WR0:/);
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 4: the dialog helpers

describe("region dialog helpers", () => {
  it("refuses an odd-length Copper region", () => {
    expect(validateRegion("copper", 0, 2)).toBe("Copper regions must contain an even number of bytes.");
    expect(validateRegion("copper", 0, 3)).toBeUndefined();
    expect(validateRegion("dma", 0, 2)).toBeUndefined();
  });

  it("suggests trimming a DMA range that ends in a long $00 run (D8)", () => {
    const bytes = [...DMA_PROGRAM, ...new Array(20).fill(0)];
    const end = bytes.length - 1;
    expect(dmaTrimSuggestion(bytes, 0, end)).toBe(DMA_PROGRAM.length - 1);
    expect(regionHint("dma", 0, end, bytes)).toEqual({
      text: "The range ends in 20 zero bytes, each listed as a WR2 write.",
      trimEnd: DMA_PROGRAM.length - 1
    });
    // --- Below the threshold: nothing to suggest
    expect(dmaTrimSuggestion([...DMA_PROGRAM, 0, 0, 0, 0, 0, 0, 0], 0, DMA_PROGRAM.length + 6)).toBeUndefined();
    // --- All zero: nothing sensible to trim to
    expect(dmaTrimSuggestion(new Array(32).fill(0), 0, 31)).toBeUndefined();
  });

  it("trims at a command boundary, never inside a command's zero follow bytes", () => {
    // --- wr4 continuous, $0000 ends in two zero follow bytes that belong to it
    const bytes = [0xad, 0x00, 0x00, ...new Array(10).fill(0)];
    expect(dmaTrimSuggestion(bytes, 0, bytes.length - 1)).toBe(2);
  });

  it("notes a Copper list that starts on an odd offset", () => {
    expect(regionHint("copper", 1, 4, [0, 0, 0, 0, 0])?.text).toMatch(/odd offset/);
    expect(regionHint("copper", 0, 3, [0, 0, 0, 0])).toBeUndefined();
  });

  it("previews Copper and DMA regions as the listing shows them", () => {
    expect(formatRegionPreview("copper", 0, 5, SPLIT_SCREEN_COPPER)).toBe(
      "$0000  .copper wait 0, 0\n$0002  .copper move $41, $1C\n$0004  .copper wait 96, 3"
    );
    expect(formatRegionPreview("dma", 0, DMA_PROGRAM.length - 1, DMA_PROGRAM)).toBe(
      [
        "$0000  .dma reset",
        "$0001  .dma wr0 a_to_b, transfer, $4000, $0020",
        "$0006  .dma wr1 memory, increment",
        "$0007  .dma wr2 memory, increment",
        "..."
      ].join("\n")
    );
  });
});
