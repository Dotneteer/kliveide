import { MI_HT1080Z } from "@common/machines/constants";
import {
  describeHt1080zPlacementProblem,
  isHt1080zPlacementProblem,
  placeHt1080zCode,
  type Ht1080zSegment
} from "@common/ht1080z/codePlacement";
import { buildHt1080zCmd, ht1080zModuleName } from "@common/ht1080z/cmdFile";
import { t } from "@common/i18n/i18n";
import { cmdToSystemTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { resolveHt1080zHardware } from "@emu/machines/ht1080z/ht1080zMachineInfo";

/*
 * Exporting HT-1080Z code (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D6, D-Q4): a `.cmd` load module or
 * a `.cas` SYSTEM tape, from the same placement rules Run uses.
 */

/** The model of a build, as `SpectrumModelType` numbers it: 7 is the HT-1080Z */
const MODEL_HT1080Z = 7;

export type Ht1080zExportFormat = "cmd" | "cas";

/**
 * The format an HT-1080Z build exports as by default: `.cmd` for a build with `.model HT1080Z`, or one
 * with no model on a running HT-1080Z; undefined for any other build
 */
export function ht1080zExportFormatOf(modelType: number | undefined, machineId: string | undefined): Ht1080zExportFormat | undefined {
  if (modelType === MODEL_HT1080Z) return "cmd";
  if (modelType === undefined && machineId === MI_HT1080Z) return "cmd";
  return undefined;
}

/**
 * The bytes of a `.cmd` or `.cas` for a build. The RAM-size check uses the running HT-1080Z's model,
 * else 16K, the smallest.
 * @param name The file name the module name is made of
 * @returns the file's bytes, or the reason the build cannot be exported
 */
export function ht1080zExportFile(
  format: Ht1080zExportFormat,
  build: { segments: Ht1080zSegment[]; entryAddress?: number },
  machineId: string | undefined,
  config: Record<string, any> | undefined,
  name: string
): { data: Uint8Array } | { error: string } {
  const ramKb = machineId === MI_HT1080Z ? resolveHt1080zHardware(config).ramKb : 16;
  const placement = placeHt1080zCode(build.segments, build.entryAddress, ramKb);
  if (isHt1080zPlacementProblem(placement)) return { error: describeHt1080zPlacementProblem(placement) };
  const cmd = buildHt1080zCmd(placement.segments, placement.entry, name);
  return { data: format === "cmd" ? cmd : cmdToSystemTape(cmd, ht1080zModuleName(name)) };
}

/** Why an HT-1080Z build cannot be exported in a format of another machine, or undefined */
export function ht1080zFormatProblem(format: string | undefined): string | undefined {
  if (!format || format === "cmd" || format === "cas" || format === "hex") return undefined;
  return t("commands.compile.ht1080zFormat", { format });
}
