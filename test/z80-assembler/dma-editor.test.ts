import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { dmaLineAt, dmaProgramsOfFile, dmaProgramSummary, groupDmaPrograms, type DmaProgram } from "@common/zxnext/dma/dmaProgram";
import { computeDmaCodeLenses, computeDmaHover, DMA_LINE_RE } from "@renderer/appIde/services/dma-editor";

/*
 * The `.dma` editor support (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §10.1, §10.3): program grouping,
 * the summary, the hover and the code lens, fed with the per-line bytes of a real assembly, as the
 * editor gets them from the last build.
 */

/** Assembles `source` and returns its `.dma` programs as the editor gets them from the build */
async function build(source: string): Promise<DmaProgram<number>[]> {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  const result = await new Z80Assembler().compile(source, opts);
  expect(result.errorCount).toBe(0);
  return dmaProgramsOfFile(result.dmaPrograms, 0);
}

const SAMPLE = `        .org $8100
Prog:   .dma disable
        .dma wr0 a_to_b, transfer, $c000, 2048
        .dma wr1 memory, increment
        .dma wr2 io, fixed, 3t, 55
        .dma wr4 burst, $00df
        .dma wr5 auto_restart
        .dma load
        .dma enable`;

describe(".dma programs: grouping", () => {
  it("one program from contiguous .dma lines", async () => {
    const programs0 = await build(SAMPLE);
    const programs = programs0;
    expect(programs).toHaveLength(1);
    expect(programs[0].lines.map((l) => l.key)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(programs[0].start).toBe(0);
    expect(programs[0].commands.map((c) => c.kind)).toEqual(["wr6", "wr0", "wr1", "wr2", "wr4", "wr5", "wr6", "wr6"]);
  });

  it("the runtime patching pattern's .dw values join the program", async () => {
    const programs0 = await build(`        .org $8000
        .dma wr0 a_to_b, transfer
PortA:  .dw 0
Length: .dw 0
        .dma wr4 continuous
        .dw $005b
        .dma load`);
    const programs = programs0;
    expect(programs).toHaveLength(1);
    const summary = dmaProgramSummary(programs[0]);
    expect(summary).toMatchObject({ aToB: true, portA: "patched", blockLength: "patched", portB: 0x005b, mode: 1, loads: true });
    // --- a data byte belongs to the .dma line before it
    expect(dmaLineAt(programs[0], 2).key).toBe(2);
  });

  it("code between .dma lines starts a new program", async () => {
    const programs0 = await build(`        .org $8000
        .dma wr4 continuous, $4800
        nop
        .dma load`);
    expect(programs0).toHaveLength(2);
  });

  it("a gap shorter than the pending follow bytes stays in the program (and is swallowed)", () => {
    // --- WR4 announces port B lo/hi; one data byte, then a .dma line
    const bytes = [0xad, 0x00, 0x82];
    const programs = groupDmaPrograms(bytes, [
      { key: "wr4", offset: 0, length: 1 },
      { key: "wr5", offset: 2, length: 1 }
    ]);
    expect(programs).toHaveLength(1);
    expect(programs[0].commands).toHaveLength(1);
  });

  it("recognises .dma lines with labels and without the dot", () => {
    expect(DMA_LINE_RE.test("Prog: .dma reset")).toBe(true);
    expect(DMA_LINE_RE.test("  dma load")).toBe(true);
    expect(DMA_LINE_RE.test("  ld a,(dma)")).toBe(false);
    expect(DMA_LINE_RE.test("  ; .dma reset")).toBe(false);
  });
});

describe(".dma programs: hover and code lens", () => {
  it("the code lens summarises the program over its first line", async () => {
    const programs0 = await build(SAMPLE);
    expect(computeDmaCodeLenses(programs0)).toEqual([
      {
        lineNumber: 2,
        title: "DMA program: $C000 → port $00DF · 2,048 bytes · burst · prescaler 55: 223 T a byte, 15695 Hz at 3.5 MHz · auto restart"
      }
    ]);
  });

  it("the hover decodes the line's register group and repeats the summary", async () => {
    const programs0 = await build(SAMPLE);
    const hover = computeDmaHover(5, programs0)!;
    expect(hover.contents[0]).toBe("**WR2** · port B I/O, fixed, 3T cycle, prescaler 55 *(zxnDMA)*");
    expect(hover.contents[1]).toMatch(/^DMA program: \$C000 → port \$00DF/);
    expect(computeDmaHover(1, programs0)).toBeNull();
  });

  it("the hover of a swallowed line says so", async () => {
    const programs0 = await build(`        .org $8000
        .dma wr0 a_to_b, transfer, $4000
        .dma wr1 memory, increment`);
    const hover = computeDmaHover(3, programs0)!;
    expect(hover.contents[0]).toBe("This line's first byte is taken as a follow byte of an earlier register group.");
  });

  it("nothing before a build", () => {
    expect(dmaProgramsOfFile([], 0)).toEqual([]);
  });

  it("a B to A transfer from an I/O port reads the other way round", async () => {
    const programs0 = await build(`        .org $8000
        .dma wr0 b_to_a, transfer, $c000, 512
        .dma wr1 memory, increment
        .dma wr2 io, fixed
        .dma wr4 continuous, $00eb`);
    expect(computeDmaCodeLenses(programs0)[0].title).toBe(
      "DMA program: port $00EB → $C000 · 512 bytes · continuous"
    );
  });
});
