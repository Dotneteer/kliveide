import { MI_ENTERPRISE } from "@common/machines/constants";
import { t } from "@common/i18n/i18n";
import {
  describeEpPlacementProblem,
  epComFile,
  isEpPlacementProblem,
  placeEpCode,
  type EpSegment
} from "@common/enterprise/codePlacement";

/*
 * Exporting Enterprise code (`.plans/ENTERPRISE_PLAN.md` §12): a `.com` file, an EXOS `$$APP` module -
 * the 16-byte header and the code from 0100h (`common/enterprise/codePlacement.ts`) - which
 * `LOAD "FILE:name.COM"` (or from a disk) loads and starts.
 */

const MODEL_ENTERPRISE = 9;

/** The format an Enterprise build exports as by default: `.com` for `.model ENTERPRISE`, or no model on a running Enterprise */
export function epExportFormatOf(modelType: number | undefined, machineId: string | undefined): "com" | undefined {
  if (modelType === MODEL_ENTERPRISE) return "com";
  if (modelType === undefined && machineId === MI_ENTERPRISE) return "com";
  return undefined;
}

/**
 * The bytes of a `.com` for a build
 * @returns the file's bytes, or the reason the build cannot be exported
 */
export function epExportFile(build: { segments: EpSegment[]; entryAddress?: number }): { data: Uint8Array } | { error: string } {
  const placement = placeEpCode(build.segments, build.entryAddress);
  if (isEpPlacementProblem(placement)) return { error: describeEpPlacementProblem(placement) };
  return { data: epComFile(placement) };
}

/** Why an Enterprise build cannot be exported in a format of another machine, or undefined */
export function epFormatProblem(format: string | undefined): string | undefined {
  if (!format || format === "com" || format === "hex") return undefined;
  return t("commands.compile.epFormat", { format });
}
