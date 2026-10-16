import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/**
 * The ZX80/ZX81 models of the Klive assembler (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D2): the
 * `.model` names, `#ifmod`, the pragmas they rule out, `.defzx`, and the warning for code above $7FFF.
 */
async function compile(source: string, currentModel?: number) {
  const opts = new AssemblerOptions();
  if (currentModel !== undefined) opts.currentModel = currentModel;
  return await new Z80Assembler().compile(source, opts);
}

const errorCodes = (out: { errors: { errorCode: string; isWarning?: boolean }[] }) =>
  out.errors.filter((e) => !e.isWarning).map((e) => e.errorCode);
const warningCodes = (out: { errors: { errorCode: string; isWarning?: boolean }[] }) =>
  out.errors.filter((e) => e.isWarning).map((e) => e.errorCode);

describe("Z80 Assembler - ZX80/ZX81 models", () => {
  it.each([
    ["ZX81", SpectrumModelType.ZX81],
    ["zx81", SpectrumModelType.ZX81],
    ["ZX80", SpectrumModelType.ZX80],
    ["Zx80", SpectrumModelType.ZX80]
  ])(".model %s sets the model type", async (name, expected) => {
    const out = await compile(`.model ${name}\n nop`);
    expect(errorCodes(out)).toEqual([]);
    expect(out.modelType).toBe(expected);
  });

  it("#ifmod picks the ZX81 branch", async () => {
    const out = await compile(`
      .model ZX81
      #ifmod ZX81
        ld a,1
      #else
        ld a,2
      #endif
      #ifnmod ZX80
        nop
      #endif
    `);
    expect(errorCodes(out)).toEqual([]);
    expect(out.segments[0].emittedCode).toEqual([0x3e, 0x01, 0x00]);
  });

  it("#ifmod ZX80 follows the current model when there is no .model", async () => {
    const out = await compile(
      `
      #ifmod ZX80
        ld a,1
      #else
        ld a,2
      #endif
    `,
      SpectrumModelType.ZX80
    );
    expect(out.segments[0].emittedCode).toEqual([0x3e, 0x01]);
  });

  it.each(["ZX80", "ZX81"])(".bank is an error under .model %s", async (name) => {
    const out = await compile(`.model ${name}\n .bank 1\n nop`);
    expect(errorCodes(out)).toContain("Z0308");
  });

  it("still accepts .bank on the Spectrum 128", async () => {
    const out = await compile(`.model Spectrum128\n .bank 1\n nop`);
    expect(errorCodes(out)).toEqual([]);
  });

  it("rejects Next instructions under .model ZX81", async () => {
    const out = await compile(`.model ZX81\n swapnib`);
    expect(errorCodes(out)).toEqual(["Z0414"]);
  });

  it("rejects the Next pragmas under .model ZX81", async () => {
    const out = await compile(`.model ZX81\n .copper halt`);
    expect(errorCodes(out)).toEqual(["Z0372"]);
  });

  it("warns once per segment about code above $7FFF", async () => {
    const out = await compile(`.model ZX81\n .org $7ffe\n nop\n nop\n nop\n nop`);
    expect(errorCodes(out)).toEqual([]);
    expect(warningCodes(out)).toEqual(["Z0378"]);
  });

  it("does not warn below $8000", async () => {
    const out = await compile(`.model ZX81\n .org $4082\n ret`);
    expect(out.errors).toEqual([]);
  });

  it("does not warn above $7FFF on a Spectrum", async () => {
    const out = await compile(`.org $8000\n ret`);
    expect(out.errors).toEqual([]);
  });
});

describe("Z80 Assembler - .defzx", () => {
  it("emits ZX81 characters", async () => {
    const out = await compile(`.model ZX81\n .defzx "HELLO, 2026!"`);
    expect(errorCodes(out)).toContain("Z0381"); // the ZX81 has no '!'
    const ok = await compile(`.model ZX81\n .defzx "HELLO, 2026."`);
    expect(errorCodes(ok)).toEqual([]);
    expect(ok.segments[0].emittedCode).toEqual([
      0x2d, 0x2a, 0x31, 0x31, 0x34, 0x1a, 0x00, 0x1e, 0x1c, 0x1e, 0x22, 0x1b
    ]);
  });

  it("emits the ZX80's own codes for the symbols", async () => {
    const out = await compile(`.model ZX80\n .defzx "A=\\"$"`);
    expect(errorCodes(out)).toEqual([]);
    // --- '=' is $14 on the ZX81 but $16 on the ZX80; '"' $0B vs $01
    expect(out.segments[0].emittedCode).toEqual([0x26, 0x16, 0x01, 0x0d]);
  });

  it("turns lower-case letters into inverse-video capitals", async () => {
    const out = await compile(`.model ZX81\n .defzx "Ok"`);
    expect(out.segments[0].emittedCode).toEqual([0x34, 0xb0]);
  });

  it("works with a label", async () => {
    const out = await compile(`.model ZX81\nmsg .defzx "AB"\n ld hl,msg`);
    expect(errorCodes(out)).toEqual([]);
    expect(out.segments[0].emittedCode.slice(0, 2)).toEqual([0x26, 0x27]);
  });

  it("is an error without a ZX80/ZX81 model", async () => {
    const out = await compile(`.defzx "A"`);
    expect(errorCodes(out)).toEqual(["Z0379"]);
  });

  it("needs a string", async () => {
    const out = await compile(`.model ZX81\n .defzx 3`);
    expect(errorCodes(out)).toEqual(["Z0380"]);
  });

  it("accepts the dotless and upper-case forms", async () => {
    const out = await compile(`.model ZX81\n defzx "A"\n DEFZX "B"\n .DEFZX "C"`);
    expect(out.segments[0].emittedCode).toEqual([0x26, 0x27, 0x28]);
  });
});

describe("Z80 Assembler - ZX80/ZX81 default origin", () => {
  it.each([
    ["ZX81", 0x4082],
    ["ZX80", 0x402b],
    ["Spectrum48", 0x8000]
  ])("code with no .org under .model %s starts at %i", async (name, start) => {
    const out = await compile(`.model ${name}\n ret`);
    expect(out.segments[0].startAddress).toBe(start);
    expect(out.errors).toEqual([]);
  });
});
