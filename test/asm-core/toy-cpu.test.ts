import { describe, expect, it } from "vitest";
import { ToyAssembler } from "./toy-cpu";

/** Assembles `source` with the toy CPU and returns the first segment's bytes */
async function toyBytes(source: string): Promise<number[]> {
  const output = await new ToyAssembler().compile(source);
  expect(output.errors.map((e) => `${e.errorCode} ${e.message}`)).toEqual([]);
  return output.segments.length === 0 ? [] : Array.from(output.segments[0].emittedCode);
}

describe("CPU-neutral assembler core - a toy CPU", () => {
  it("assembles its own instructions", async () => {
    expect(await toyBytes(" nop\n rts\n lda #$12\n sta $c000")).toEqual([0xea, 0x60, 0xa9, 0x12, 0x8d, 0x00, 0xc0]);
  });

  it("resolves forward labels with the core's fixups", async () => {
    expect(await toyBytes(" .org $c000\n jmp End\n nop\nEnd: rts")).toEqual([0x4c, 0x04, 0xc0, 0xea, 0x60]);
  });

  it("resolves its own relative-branch fixup through the hook", async () => {
    expect(await toyBytes("Back: inx\n bne Back\n bne Fwd\nFwd: nop")).toEqual([0xe8, 0xd0, 0xfd, 0xd0, 0x00, 0xea]);
  });

  it("expands macros, with its own operand kind as an argument", async () => {
    const source = `
      Load: .macro(value)
        lda {{value}}
      .endm
      Load(#5)
      Load($1234)
    `;
    expect(await toyBytes(source)).toEqual([0xa9, 0x05, 0xad, 0x34, 0x12]);
  });

  it("runs loops, conditionals and expressions", async () => {
    const source = `
      .loop 3
        inx
      .endl
      .if 2 > 1
        nop
      .else
        rts
      .endif
      Count .equ 2 * 3
      lda #Count
    `;
    expect(await toyBytes(source)).toEqual([0xe8, 0xe8, 0xe8, 0xea, 0xa9, 0x06]);
  });

  it("emits structures and field assignments", async () => {
    const source = `
      Point
      .struct
        .defb 0
        .defw 0
      .ends
      Point()
      -> .defb 7
    `;
    expect(await toyBytes(source)).toEqual([0x07, 0x00, 0x00]);
  });

  it("knows no Z80 register: `hl` is an ordinary symbol", async () => {
    expect(await toyBytes("hl .equ 3\n lda #hl")).toEqual([0xa9, 0x03]);
  });

  it("textof takes its own mnemonics", async () => {
    expect(await toyBytes(" .defm textof(lda)")).toEqual([0x4c, 0x44, 0x41]);
  });

  it("uses its own models for the default code address", async () => {
    const output = await new ToyAssembler().compile(" .model T1\n nop");
    expect(output.errorCount).toBe(0);
    expect(output.segments[0].startAddress).toBe(0x0801);
  });

  it("has no ZX Spectrum memory banks", async () => {
    const output = await new ToyAssembler().compile(" .model T1\n .bank 1\n nop");
    expect(output.errors.map((e) => e.errorCode)).toEqual(["Z0308"]);
  });

  it("does not know the Z80 machines' pragmas", async () => {
    const output = await new ToyAssembler().compile(' .savenex file "a.nex"\n .defzx "AB"');
    expect(output.errorCount).toBeGreaterThan(0);
  });
});
