import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { defaultModelTypeForMachine, SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { modelTypeToMachineType } from "@renderer/appIde/utils/compile-code";
import { bootModelFor } from "@main/unit-tests/UnitTestRunner";

/**
 * The Videoton TVC model of the Klive assembler (`.plans/VIDEOTON_TVC_PLAN.md` §11): the `.model`
 * name, `#ifmod`, no banks, the default address, and the warnings for code Run and Export refuse.
 */
async function compile(source: string, currentModel?: number) {
  const opts = new AssemblerOptions();
  if (currentModel !== undefined) opts.currentModel = currentModel;
  return await new Z80Assembler().compile(source, opts);
}

const codes = (out: { errors: { errorCode: string; isWarning?: boolean }[] }, warning: boolean) =>
  out.errors.filter((e) => !!e.isWarning === warning).map((e) => e.errorCode);

describe("Z80 Assembler - Videoton TVC model", () => {
  it.each(["TVC", "tvc", "Tvc"])(".model %s sets the model type", async (name) => {
    const out = await compile(`.model ${name}\n .org $1A30\n nop`);
    expect(codes(out, false)).toEqual([]);
    expect(out.modelType).toBe(SpectrumModelType.TVC);
  });

  it("#ifmod picks the TVC branch, with .model or as the running machine's", async () => {
    const source = `
      .org $1A30
      #ifmod TVC
        ld a,1
      #else
        ld a,2
      #endif`;
    expect((await compile(`.model TVC\n${source}`)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
    expect((await compile(source, SpectrumModelType.TVC)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
  });

  it("refuses .bank", async () => {
    expect(codes(await compile(".model TVC\n .bank 3\n nop"), false)).toContain("Z0308");
  });

  it("puts code with no .org at $1A30, after BASIC's launcher line", async () => {
    const out = await compile(".model TVC\n ld a,1");
    expect(out.segments[0].startAddress).toBe(0x1a30);
    expect(codes(out, true)).toEqual([]);
  });

  it("warns about code in the system area and too high for BASIC", async () => {
    expect(codes(await compile(".model TVC\n .org $1000\n nop\n nop"), true)).toEqual(["Z0384"]);
    expect(codes(await compile(".model TVC\n .org $BBFF\n nop\n nop"), true)).toEqual(["Z0385"]);
    expect(codes(await compile(".model TVC\n .org $1A30\n nop\n .org $BBFF\n nop"), true)).toEqual([]);
    // --- Only the TVC
    expect(codes(await compile(".org $1000\n nop"), true)).toEqual([]);
  });

  it("maps the machine and the model to each other", () => {
    expect(defaultModelTypeForMachine("tvc")).toBe(SpectrumModelType.TVC);
    expect(modelTypeToMachineType(SpectrumModelType.TVC)).toBe("tvc");
    expect(bootModelFor("tvc", SpectrumModelType.TVC)).toBe("tvc");
  });
});
