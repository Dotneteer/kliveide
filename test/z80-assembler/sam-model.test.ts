import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { defaultModelTypeForMachine, isSamCoupeModelType, SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { modelTypeToMachineType } from "@renderer/appIde/utils/compile-code";
import { bootModelFor } from "@main/unit-tests/UnitTestRunner";
import { samDiskFileName, samExportFile, samExportFormatOf, samFormatProblem } from "@renderer/appIde/utils/sam-code";

/**
 * The SAM Coupé model of the Klive assembler (`dev/plans/SAM_COUPE_PLAN.md` §12): the `.model` name,
 * `#ifmod`, the default address, the machine and model mapped to each other, and the export formats.
 */
async function compile(source: string, currentModel?: number) {
  const opts = new AssemblerOptions();
  if (currentModel !== undefined) opts.currentModel = currentModel;
  return await new Z80Assembler().compile(source, opts);
}

describe("Z80 Assembler - SAM Coupé model", () => {
  it.each(["SAMCOUPE", "samcoupe", "SamCoupe"])(".model %s sets the model type", async (name) => {
    const out = await compile(`.model ${name}\n nop`);
    expect(out.errors.filter((e) => !e.isWarning)).toEqual([]);
    expect(out.modelType).toBe(SpectrumModelType.SamCoupe);
    expect(isSamCoupeModelType(out.modelType)).toBe(true);
  });

  it("#ifmod picks the SAM branch, with .model or as the running machine's", async () => {
    const source = `
      #ifmod SAMCOUPE
        ld a,1
      #else
        ld a,2
      #endif`;
    expect((await compile(`.model SAMCOUPE\n${source}`)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
    expect((await compile(source, SpectrumModelType.SamCoupe)).segments[0].emittedCode).toEqual([0x3e, 0x01]);
  });

  it("puts code with no .org at $8000, page 1 under Run's paging", async () => {
    expect((await compile(".model SAMCOUPE\n ld a,1")).segments[0].startAddress).toBe(0x8000);
  });

  it("maps the machine and the model to each other", () => {
    expect(defaultModelTypeForMachine("sam")).toBe(SpectrumModelType.SamCoupe);
    expect(modelTypeToMachineType(SpectrumModelType.SamCoupe)).toBe("sam");
    expect(bootModelFor("sam", SpectrumModelType.SamCoupe)).toBe("sam");
  });

  it("exports as .mgt by default, .bin and Intel HEX too, and refuses another machine's format", () => {
    expect(samExportFormatOf(SpectrumModelType.SamCoupe, "sp48")).toBe("mgt");
    expect(samExportFormatOf(undefined, "sam")).toBe("mgt");
    expect(samExportFormatOf(undefined, "sp48")).toBeUndefined();
    expect(samFormatProblem("bin")).toBeUndefined();
    expect(samFormatProblem("hex")).toBeUndefined();
    expect(samFormatProblem("tap")).toMatch(/tap/);
    expect(samExportFile("bin", { segments: [{ startAddress: 0x1000, emittedCode: [0] }] }, "x")).toMatchObject({ error: expect.stringMatching(/ROM/) });
    // --- Two pages: the gap between them filled with zeros
    const bin = samExportFile("bin", { segments: [{ startAddress: 0x8000, emittedCode: [1] }, { startAddress: 0xc000, emittedCode: [2] }] }, "x");
    if ("error" in bin) throw new Error(bin.error);
    expect(bin.data.length).toBe(0x4001);
    expect([bin.data[0], bin.data[0x4000]]).toEqual([1, 2]);
  });

  it("names the disk file after the export, without its extension, in ten ASCII characters", () => {
    expect(samDiskFileName("C:/out/mygame.mgt")).toBe("mygame");
    expect(samDiskFileName("/x/a-very-long-name.mgt")).toBe("a-very-lon");
    expect(samDiskFileName(".mgt")).toBe("CODE");
  });
});
