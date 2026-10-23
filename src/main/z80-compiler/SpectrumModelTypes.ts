import {
  MC_ZX80_ROM8K,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT,
  MI_HT1080Z
} from "@common/machines/constants";



export const enum SpectrumModelType {
  Spectrum48 = 1,
  Spectrum128 = 2,
  SpectrumP3 = 3,
  Next = 4,
  ZX80 = 5,
  ZX81 = 6,
  HT1080Z = 7
}

/**
 * The type of the Spectrum model
 */
export const SpectrumModelTypes: Record<number, string> = {
  1: "Spectrum48",
  2: "Spectrum128",
  3: "SpectrumP3",
  4: "Next",
  5: "ZX80",
  6: "ZX81",
  7: "HT1080Z"
}

/**
 * Whether a model type is one of the Sinclair ZX80/ZX81 models
 * (`.plans/ZX8081_CODE_INJECTION_PLAN.md`)
 */
export function isZx8081ModelType(modelType: number | undefined): boolean {
  return modelType === SpectrumModelType.ZX80 || modelType === SpectrumModelType.ZX81;
}

/**
 * Whether a model type is the HT-1080Z's, every model of it (`.plans/HT1080Z_CODE_INJECTION_PLAN.md`
 * D1, D-Q1)
 */
export function isHt1080zModelType(modelType: number | undefined): boolean {
  return modelType === SpectrumModelType.HT1080Z;
}

/**
 * Finds the Spectrum model type by its name.
 * @param name The name of the Spectrum model.
 * @returns The corresponding model type number, or undefined if not found.
 */
export function findModelTypeByName(name: string): number | undefined {
  const modelType = Object.entries(SpectrumModelTypes).find(([_, modelName]) => modelName.toLowerCase() === name.toLowerCase());
  return modelType ? parseInt(modelType[0], 10) : undefined;
} 
/**
 * The model a source with no `.model` pragma is assembled for: the running machine's
 * (`.plans/ZX8081_CODE_INJECTION_PLAN.md` §7, Q1). A ZX80 with the 8K ROM runs ZX81 code. Machines
 * with no model of their own (the Timex, the Scorpion, the Z88) keep the 48K default.
 * @param machineId The running machine
 * @param config The running machine's configuration
 */
export function defaultModelTypeForMachine(
  machineId: string | undefined,
  config?: Record<string, any>
): SpectrumModelType | undefined {
  switch (machineId) {
    case MI_SPECTRUM_48:
      return SpectrumModelType.Spectrum48;
    case MI_SPECTRUM_128:
      return SpectrumModelType.Spectrum128;
    case MI_SPECTRUM_3E:
      return SpectrumModelType.SpectrumP3;
    case MI_ZXNEXT:
      return SpectrumModelType.Next;
    case MI_ZX81:
      return SpectrumModelType.ZX81;
    case MI_ZX80:
      return config?.[MC_ZX80_ROM8K] === true ? SpectrumModelType.ZX81 : SpectrumModelType.ZX80;
    case MI_HT1080Z:
      return SpectrumModelType.HT1080Z;
    default:
      return undefined;
  }
}
