import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { defaultModelTypeForMachine, SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { modelTypeToMachineType } from "@renderer/appIde/utils/compile-code";
import { bootModelFor } from "@main/unit-tests/UnitTestRunner";
import { epComFile, placeEpCode, isEpPlacementProblem } from "@common/enterprise/codePlacement";

/**
 * The Enterprise model of the Klive assembler (`.plans/ENTERPRISE_PLAN.md` §12): the `.model` name,
 * `#ifmod`, the default address (where EXOS loads a `$$APP`), the warnings for code Run and Export
 * refuse, and the `.com` file Run and Export make.
 */
async function compile(source: string, currentModel?: number) {
  const opts = new AssemblerOptions();
  if (currentModel !== undefined) opts.currentModel = currentModel;
  return await new Z80Assembler().compile(source, opts);
}

const codes = (out: { errors: { errorCode: string; isWarning?: boolean }[] }, warning: boolean) =>
  out.errors.filter((e) => !!e.isWarning === warning).map((e) => e.errorCode);

describe("Z80 Assembler - Enterprise model", () => {
  it.each(["ENTERPRISE", "enterprise", "Enterprise"])(".model %s sets the model type", async (name) => {
    const out = await compile(`.model ${name}\n nop`);
    expect(codes(out, false)).toEqual([]);
    expect(out.modelType).toBe(SpectrumModelType.Enterprise);
  });

  it("#ifmod picks the Enterprise branch, with .model or as the running machine's", async () => {
    const source = `
      #ifmod ENTERPRISE
        ld a,1
      #else
        ld a,2
      #endif`;
    expect((await compile(`.model ENTERPRISE\n${source}`)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
    expect((await compile(source, SpectrumModelType.Enterprise)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
  });

  it("puts code with no .org at $0100, where EXOS loads a program", async () => {
    const out = await compile(".model ENTERPRISE\n ld a,1");
    expect(out.segments[0].startAddress).toBe(0x0100);
    expect(codes(out, true)).toEqual([]);
  });

  it("warns about code below $0100 and in page 3", async () => {
    expect(codes(await compile(".model ENTERPRISE\n .org $0080\n nop\n nop"), true)).toEqual(["Z0386"]);
    expect(codes(await compile(".model ENTERPRISE\n .org $BFFF\n nop\n nop"), true)).toEqual(["Z0387"]);
    expect(codes(await compile(".model ENTERPRISE\n .org $0100\n nop\n .org $BFFF\n nop"), true)).toEqual([]);
    // --- Only the Enterprise
    expect(codes(await compile(".org $0080\n nop"), true)).toEqual([]);
  });

  it("maps the machine and the model to each other", () => {
    expect(defaultModelTypeForMachine("ep")).toBe(SpectrumModelType.Enterprise);
    expect(modelTypeToMachineType(SpectrumModelType.Enterprise)).toBe("ep");
    expect(bootModelFor("ep", SpectrumModelType.Enterprise)).toBe("ep");
  });

  it("makes a $$APP .com: the module header, the body from $0100, and a JP when the entry is elsewhere", () => {
    const direct = placeEpCode([{ startAddress: 0x0100, emittedCode: [0xc9] }], undefined);
    if (isEpPlacementProblem(direct)) throw new Error(direct.code);
    expect(Array.from(epComFile(direct))).toEqual([0, 5, 1, 0, ...Array(12).fill(0), 0xc9]);
    const jumped = placeEpCode([{ startAddress: 0x0200, emittedCode: [0xc9] }], 0x0200);
    if (isEpPlacementProblem(jumped)) throw new Error(jumped.code);
    expect(Array.from(jumped.body.subarray(0, 3))).toEqual([0xc3, 0x00, 0x02]);
    expect(placeEpCode([{ startAddress: 0x0100, emittedCode: [0, 0, 0, 0xc9] }], 0x0103)).toEqual({ code: "entry", entry: 0x0103 });
    expect(placeEpCode([{ startAddress: 0x00f0, emittedCode: [0] }], undefined)).toEqual({ code: "tooLow", address: 0x00f0 });
    expect(placeEpCode([{ startAddress: 0xbfff, emittedCode: [0, 0] }], undefined)).toEqual({ code: "tooHigh", address: 0xc000 });
  });
});
