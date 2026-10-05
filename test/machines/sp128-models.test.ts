import { describe, expect, it } from "vitest";

import { MC_DISK_SUPPORT, MC_SP128_TIMING, MI_SPECTRUM_128 } from "@common/machines/constants";
import { getModelConfig, machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { getHardwareSpec } from "@common/machines/hardware-specs";
import { resolveMachineModel } from "@common/machines/machine-favorites";
import {
  getSp128Model,
  getSp128Timing,
  SP128_MODELS,
  SP128_TIMINGS
} from "@emu/machines/zxSpectrum128/sp128Timings";
import { mergeZxSpectrum128Config } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmHost";

/*
 * The ZX Spectrum 128K machine's two models, the 128K and the Pentagon 128
 * (`.plans/PENTAGON_128_PLAN.md` P1, P2), and how references from before the models resolve.
 */

describe("ZX Spectrum 128K models", () => {
  it("registers the 128K first and the Pentagon second", () => {
    const sp128 = machineRegistry.find((m) => m.machineId === MI_SPECTRUM_128)!;
    expect(sp128.displayName).toBe("ZX Spectrum 128K");
    expect(sp128.models!.map((m) => [m.modelId, m.displayName])).toEqual([
      ["sp128", "ZX Spectrum 128K"],
      ["pentagon", "Pentagon 128"]
    ]);
    // --- The Pentagon has the Beta 128's two drives (`.plans/BETA128_TRDOS_PLAN.md` B1)
    expect(getModelConfig(MI_SPECTRUM_128, "pentagon")).toEqual({ [MC_SP128_TIMING]: "pentagon", [MC_DISK_SUPPORT]: 2 });
    expect(getModelConfig(MI_SPECTRUM_128, "sp128")).toEqual({ [MC_SP128_TIMING]: "sp128" });
  });

  it("a reference without a model id means the 128K model", () => {
    expect(resolveModelId(MI_SPECTRUM_128, undefined)).toBe("sp128");
    expect(resolveModelId(MI_SPECTRUM_128, "pentagon")).toBe("pentagon");
    expect(resolveModelId("sp48", undefined)).toBeUndefined();
    expect(resolveMachineModel(machineRegistry, MI_SPECTRUM_128, undefined)).toEqual({
      machineId: MI_SPECTRUM_128,
      modelId: "sp128",
      displayName: "ZX Spectrum 128K"
    });
  });

  it("a config without a timing is the 128K's; an unknown one too", () => {
    expect(getSp128Timing(undefined).id).toBe("sp128");
    expect(getSp128Timing({}).id).toBe("sp128");
    expect(getSp128Timing({ [MC_SP128_TIMING]: "scorpion" }).id).toBe("sp128");
    expect(getSp128Timing({ [MC_SP128_TIMING]: "pentagon" })).toBe(SP128_TIMINGS.pentagon);
  });

  it("the model's timing wins over the project's config; other settings keep the project's", () => {
    const pentagon = getSp128Model("pentagon")!;
    const sp128 = getSp128Model("sp128")!;
    expect(mergeZxSpectrum128Config(pentagon, { [MC_SP128_TIMING]: "sp128", other: 1 })).toEqual({
      [MC_SP128_TIMING]: "pentagon",
      [MC_DISK_SUPPORT]: 2,
      other: 1
    });
    expect(mergeZxSpectrum128Config(sp128, { [MC_SP128_TIMING]: "pentagon" })).toEqual({ [MC_SP128_TIMING]: "sp128" });
    expect(mergeZxSpectrum128Config(undefined, { [MC_SP128_TIMING]: "pentagon" })).toEqual({
      [MC_SP128_TIMING]: "pentagon"
    });
    expect(getSp128Model(undefined)).toBeUndefined();
  });

  it("the hardware sheet agrees with the timing table", () => {
    const info = machineRegistry.find((m) => m.machineId === MI_SPECTRUM_128)!;
    for (const model of SP128_MODELS) {
      const t = SP128_TIMINGS[model.modelId as keyof typeof SP128_TIMINGS];
      const spec = getHardwareSpec(info, model.modelId)!;
      expect(spec.clockHz).toBe(t.clockHz);
      expect(spec.timing.perLine).toBe(t.tactsPerLine);
      expect(spec.timing.linesPerFrame).toBe(t.linesPerFrame);
      expect(spec.timing.perFrame).toBe(t.tactsPerFrame);
    }
  });
});
