import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AppState } from "@common/state/AppState";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { Z80Compiler } from "@main/z80-compiler/Z80Compiler";
import { defaultModelTypeForMachine, SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { modelTypeToMachineType } from "@renderer/appIde/utils/compile-code";
import { getSjasmModelType } from "@main/sjasmp-integration/SjasmPCompiler";

/**
 * The HT-1080Z model of the Klive assembler (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D1, D2): the
 * `.model` name, `#ifmod`, no banks, the default address, and the warnings for code the machine cannot
 * load or BASIC overwrites.
 */
async function compile(source: string, currentModel?: number) {
  const opts = new AssemblerOptions();
  if (currentModel !== undefined) opts.currentModel = currentModel;
  return await new Z80Assembler().compile(source, opts);
}

const codes = (out: { errors: { errorCode: string; isWarning?: boolean }[] }, warning: boolean) =>
  out.errors.filter((e) => !!e.isWarning === warning).map((e) => e.errorCode);

describe("Z80 Assembler - HT-1080Z model", () => {
  it.each(["HT1080Z", "ht1080z", "Ht1080Z"])(".model %s sets the model type", async (name) => {
    const out = await compile(`.model ${name}\n .org $7000\n nop`);
    expect(codes(out, false)).toEqual([]);
    expect(out.modelType).toBe(SpectrumModelType.HT1080Z);
  });

  it("#ifmod picks the HT-1080Z branch, with .model or as the running machine's", async () => {
    const source = `
      .org $7000
      #ifmod HT1080Z
        ld a,1
      #else
        ld a,2
      #endif
      #ifnmod ZX81
        nop
      #endif`;
    expect((await compile(`.model HT1080Z\n${source}`)).segments[0].emittedCode).toEqual([0x3e, 0x01, 0x00]);
    expect((await compile(source, SpectrumModelType.HT1080Z)).segments[0].emittedCode).toEqual([0x3e, 0x01, 0x00]);
  });

  it("refuses .bank: the HT-1080Z pages nothing", async () => {
    const out = await compile(".model HT1080Z\n .bank 3\n nop");
    expect(codes(out, false)).toContain("Z0308");
  });

  it("puts code with no .org at $7000, free RAM on every model", async () => {
    const out = await compile(".model HT1080Z\n ld a,1");
    expect(out.segments[0].startAddress).toBe(0x7000);
    expect(codes(out, true)).toEqual([]);
  });

  it("warns about code in the ROM or keyboard area, and in video RAM or the ROM's work area", async () => {
    const rom = await compile(".model HT1080Z\n .org $3000\n nop\n nop");
    expect(codes(rom, true)).toEqual(["Z0382"]);
    const video = await compile(".model HT1080Z\n .org $3C00\n .defs 4\n .org $4200\n nop");
    expect(codes(video, true)).toEqual(["Z0383", "Z0383"]);
    const ram = await compile(".model HT1080Z\n .org $42E9\n nop");
    expect(codes(ram, true)).toEqual([]);
    // --- Only the HT-1080Z: a Spectrum's $4000 is its screen, written on purpose
    expect(codes(await compile(".org $3C00\n nop"), true)).toEqual([]);
  });

  it("maps the machine and the model to each other", () => {
    expect(defaultModelTypeForMachine("ht1080z")).toBe(SpectrumModelType.HT1080Z);
    expect(modelTypeToMachineType(SpectrumModelType.HT1080Z)).toBe("ht1080z");
  });

  it("an sjasmplus build on the HT-1080Z is Spectrum code, which the machine refuses by its model", () => {
    // --- D8: sjasmplus targets the Spectrum; the HT's flow answers 'sp48' with its mismatch error
    expect(modelTypeToMachineType(getSjasmModelType(" nop", "ht1080z"))).toBe("sp48");
  });

  it("assembles a source with no .model as HT-1080Z code on the HT-1080Z", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-ht-model-"));
    try {
      const file = join(dir, "main.kz80.asm");
      writeFileSync(file, "#ifmod HT1080Z\n ld a,1\n#endif");
      const compiler = new Z80Compiler();
      compiler.setAppState({ emulatorState: { machineId: "ht1080z", config: {} } } as unknown as AppState);
      const out = (await compiler.compileFile(file)) as any;
      expect(out.segments[0].startAddress).toBe(0x7000);
      expect(out.segments[0].emittedCode).toEqual([0x3e, 0x01]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
