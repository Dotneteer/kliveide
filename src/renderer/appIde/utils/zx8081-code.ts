import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { buildZx8081ProgramImage, Zx8081ImageError, type Zx8081CodeSegment } from "@common/zx8081/programImage";
import { resolveZx8081Hardware } from "@emu/machines/zx8081/zx8081MachineInfo";

/**
 * Checks, before anything is sent to the emulator, that built code can go into the running ZX80 or
 * ZX81 (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D4): the machine lays it out as a `1 REM` program the
 * same way, so a layout the machine would refuse is reported here as a plain command error.
 * @returns undefined when the machine is not a ZX80/ZX81 or the code fits; otherwise the reason
 */
export function zx8081InjectionProblem(
  machineId: string | undefined,
  config: Record<string, any> | undefined,
  segments: Zx8081CodeSegment[],
  entryAddress: number | undefined,
  isUnitTest = false
): string | undefined {
  if (machineId !== MI_ZX80 && machineId !== MI_ZX81) return undefined;
  if (isUnitTest) {
    return "Debugging a unit test in the emulator does not work on the ZX80/ZX81 yet; run the tests with test-run.";
  }
  const hardware = resolveZx8081Hardware(machineId, config);
  try {
    buildZx8081ProgramImage(segments, entryAddress, hardware.romZx81, { ramKb: hardware.ramKb });
    return undefined;
  } catch (err) {
    if (err instanceof Zx8081ImageError) return err.message;
    throw err;
  }
}

/** The model of a build, as `SpectrumModelType` numbers it: 5 is the ZX80, 6 the ZX81 */
const MODEL_ZX80 = 5;
const MODEL_ZX81 = 6;

/**
 * Which ZX80/ZX81 program file a build exports as (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D8): the
 * build's `.model`, else the running machine's ROM (a ZX80 with the 8K ROM runs ZX81 programs).
 * @returns "p", "o", or undefined for a build that is not ZX80/ZX81 code
 */
export function zx8081ExportFormatOf(
  modelType: number | undefined,
  machineId: string | undefined,
  config: Record<string, any> | undefined
): "p" | "o" | undefined {
  if (modelType === MODEL_ZX81) return "p";
  if (modelType === MODEL_ZX80) return "o";
  if (modelType !== undefined) return undefined;
  if (machineId !== MI_ZX80 && machineId !== MI_ZX81) return undefined;
  return resolveZx8081Hardware(machineId, config).romZx81 ? "p" : "o";
}

/**
 * The bytes of a `.p` (ZX81) or `.o` (ZX80) file for a build: the program image the IDE also runs.
 * `ramKb` decides the display file's shape and the fit check: the running ZX80/ZX81's, else 16K.
 * @returns the file's bytes, or the reason the build cannot be exported in that format
 */
export function zx8081ExportFile(
  format: "p" | "o",
  build: { modelType?: number; segments: Zx8081CodeSegment[]; entryAddress?: number },
  machineId: string | undefined,
  config: Record<string, any> | undefined,
  autoRun: boolean
): { data: Uint8Array } | { error: string } {
  const isZx81 = format === "p";
  const buildFormat = zx8081ExportFormatOf(build.modelType, undefined, undefined);
  if (build.modelType !== undefined && buildFormat !== format) {
    return {
      error: isZx81
        ? "A .p file holds a ZX81 program: assemble the code with .model ZX81."
        : "An .o file holds a ZX80 program: assemble the code with .model ZX80."
    };
  }
  const ramKb =
    machineId === MI_ZX80 || machineId === MI_ZX81 ? resolveZx8081Hardware(machineId, config).ramKb : 16;
  try {
    const image = buildZx8081ProgramImage(build.segments, build.entryAddress, isZx81, {
      ramKb,
      autoRun: isZx81 && autoRun
    });
    return { data: image.data };
  } catch (err) {
    if (err instanceof Zx8081ImageError) return { error: err.message };
    throw err;
  }
}
