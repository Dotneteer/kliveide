import { MI_SAM_COUPE } from "@common/machines/constants";
import { t } from "@common/i18n/i18n";
import {
  describeSamPlacementProblem,
  isSamPlacementProblem,
  placeSamCode,
  samLinearImage,
  type SamSegment
} from "@common/samcoupe/codePlacement";
import { buildSamBootDisk } from "@common/samcoupe/samBootDisk";

/*
 * Exporting SAM Coupé code (`dev/plans/SAM_COUPE_PLAN.md` §12), placed by the rules Run uses
 * (`common/samcoupe/codePlacement.ts`):
 *   - `.mgt`: the disk Run boots (`common/samcoupe/samBootDisk.ts`): Klive's boot loader, then the program
 *     as a CODE file with its pages and exec address; F9 boots it on a SAM or in another emulator, and a
 *     DOS can still `LOAD "name" CODE` it;
 *   - `.bin`: the raw bytes, from the lowest page/offset to the highest, gaps filled with zeros.
 */

const MODEL_SAM_COUPE = 10;

export type SamExportFormat = "mgt" | "bin";

/** The format a SAM build exports as by default: `.mgt` for `.model SAMCOUPE`, or no model on a running SAM */
export function samExportFormatOf(modelType: number | undefined, machineId: string | undefined): SamExportFormat | undefined {
  if (modelType === MODEL_SAM_COUPE) return "mgt";
  if (modelType === undefined && machineId === MI_SAM_COUPE) return "mgt";
  return undefined;
}

/**
 * The bytes of an export
 * @param format `mgt` or `bin`
 * @param build The build's segments and entry point
 * @param name The file's name on the disk (up to 10 characters)
 * @returns the file's bytes, or the reason the build cannot be exported
 */
export function samExportFile(
  format: SamExportFormat,
  build: { segments: SamSegment[]; entryAddress?: number },
  name: string
): { data: Uint8Array } | { error: string } {
  const placement = placeSamCode(build.segments, build.entryAddress);
  if (isSamPlacementProblem(placement)) return { error: describeSamPlacementProblem(placement) };
  const image = samLinearImage(placement);
  if (format === "bin") return { data: image.data };
  try {
    return { data: buildSamBootDisk(placement, samDiskFileName(name)) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** A file name a SAM directory can hold: the base name without its extension, at most 10 ASCII characters */
export function samDiskFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  const ascii = base.replace(/[^\x20-\x7e]/g, "_").slice(0, 10);
  return ascii || "CODE";
}

/** Why a SAM build cannot be exported in a format of another machine, or undefined */
export function samFormatProblem(format: string | undefined): string | undefined {
  if (!format || format === "mgt" || format === "bin" || format === "hex") return undefined;
  return t("commands.compile.samFormat", { format });
}
