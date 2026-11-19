import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * The `.dma` program warnings (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §10.2): the assembler groups the
 * `.dma` lines into programs after the fixups and reports Z0388-Z0392 as warnings, never errors.
 */

async function warningsOf(source: string): Promise<{ code: string; line: number; message: string }[]> {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  const result = await new Z80Assembler().compile(source, opts);
  expect(result.errorCount, result.errors.map((e) => e.message).join("\n")).toBe(0);
  return result.errors.filter((e) => e.isWarning).map((e) => ({ code: e.errorCode, line: e.line, message: e.message }));
}

const codes = async (source: string) => (await warningsOf(source)).map((w) => `${w.code}@${w.line}`);

describe("Z80 Assembler - .dma program warnings", () => {
  it("the reference page's complete example has none", async () => {
    expect(
      await codes(`
dmaProgram:
    .dma reset
    .dma wr0 a_to_b, transfer, $4000, 32
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous, $4800
    .dma wr5
    .dma load
    .dma enable
dmaProgram_end:`)
    ).toEqual([]);
  });

  it("the runtime patching pattern has none: .dw supplies the omitted values", async () => {
    expect(
      await codes(`
dmaProgram:
    .dma reset
    .dma wr0 a_to_b, transfer
PORT_A:
    .dw 0
BLOCK_LEN:
    .dw 0
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous
PORT_B:
    .dw $4800
    .dma wr5
    .dma load
    .dma enable`)
    ).toEqual([]);
  });

  it("Z0388: an omitted value without its .dw swallows the next line's first byte", async () => {
    const w = await warningsOf(`
    .dma reset
    .dma wr0 a_to_b, transfer, $4000
    .dma wr1 memory, increment
    .dma wr2 memory, increment`);
    expect(w[0]).toMatchObject({ code: "Z0388", line: 4 });
    expect(w[0].message).toContain("WR0 on line 3");
    expect(w[0].message).toContain("expects 2 more");
  });

  it("Z0388: one .dw where two are needed", async () => {
    expect(
      await codes(`
    .dma wr4 burst
    .db $00
    .dma wr5`)
    ).toEqual(["Z0388@4"]);
  });

  it("Z0389: an enable after new start addresses without a load", async () => {
    expect(
      await codes(`
    .dma wr0 a_to_b, transfer, $4000, 32
    .dma wr4 continuous, $4800
    .dma enable`)
    ).toEqual(["Z0389@4"]);
    // --- WR3 D6 and a raw $87 enable too
    expect(await codes(`.dma wr4 burst, $4800\n.dma wr3 dma_enable`)).toEqual(["Z0389@2"]);
    expect(await codes(`.dma wr4 burst, $4800\n.dma cmd $87`)).toEqual(["Z0389@2"]);
    // --- a load in between clears it
    expect(await codes(`.dma wr4 burst, $4800\n.dma load\n.dma enable`)).toEqual([]);
  });

  it("Z0390: auto restart in continuous mode, or burst without a prescaler", async () => {
    expect(await codes(`.dma wr4 continuous, $4800\n.dma wr5 auto_restart`)).toEqual(["Z0390@2"]);
    const w = await warningsOf(`.dma wr4 burst, $4800\n.dma wr5 auto_restart`);
    expect(w.map((x) => x.code)).toEqual(["Z0390"]);
    expect(w[0].message).toContain("burst (no prescaler)");
    expect(await codes(`.dma wr2 io, fixed, 3t, 55\n.dma wr4 burst, $00df\n.dma wr5 auto_restart`)).toEqual([]);
  });

  it("Z0391: a prescaler in continuous mode", async () => {
    expect(await codes(`.dma wr2 io, fixed, 3t, 55\n.dma wr4 continuous, $00df`)).toEqual(["Z0391@1"]);
    expect(await codes(`.dma wr2 io, fixed, 3t, 55\n.dma wr4 byte, $00df`)).toEqual(["Z0391@1"]);
  });

  it("Z0392: settings the Next's DMA ignores", async () => {
    const w = await warningsOf(`.dma wr0 a_to_b, search, $4000, 32\n.dma wr3 int_enable, stop_on_match`);
    expect(w.map((x) => `${x.code}@${x.line}`)).toEqual(["Z0392@1", "Z0392@2"]);
    expect(w[0].message).toContain("search");
    expect(w[1].message).toContain("int_enable, stop_on_match");
  });

  it("uses the values of symbols resolved after the program", async () => {
    // --- the prescaler is a forward reference: the fixup patches it before the check
    expect(await codes(`.dma wr2 io, fixed, 3t, Rate\n.dma wr4 continuous, $00df\nRate .equ 55`)).toEqual(["Z0391@1"]);
    expect(await codes(`.dma wr2 io, fixed, 3t, Rate\n.dma wr4 continuous, $00df\nRate .equ 0`)).toEqual([]);
  });

  it("code between two .dma lines separates two programs", async () => {
    expect(
      await codes(`
    .dma wr4 continuous, $4800
    nop
    ld a,b
    .dma wr5 auto_restart`)
    ).toEqual([]);
  });

  it("is not reported for .dma lines on another model, which emit nothing", async () => {
    const opts = new AssemblerOptions();
    opts.currentModel = SpectrumModelType.Spectrum48;
    const result = await new Z80Assembler().compile(`.dma wr4 continuous, $4800\n.dma wr5 auto_restart`, opts);
    expect(result.errors.filter((e) => e.isWarning)).toEqual([]);
  });
});
