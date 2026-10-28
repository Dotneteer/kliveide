import { MI_TVC } from "@common/machines/constants";
import { t } from "@common/i18n/i18n";
import {
  describeTvcPlacementProblem,
  isTvcPlacementProblem,
  placeTvcCode,
  tvcProgramPayload,
  type TvcSegment
} from "@common/tvc/codePlacement";
import { buildTvcCasFile } from "@emu/machines/tvc/TvcCasFile";

/*
 * Exporting Videoton TVC code (`.plans/VIDEOTON_TVC_PLAN.md` §11): a `.cas` program file, the way TVC
 * machine code is distributed - the one-line BASIC launcher at 19EFh and the code where it was
 * assembled (`common/tvc/codePlacement.ts`), with the autostart flag, so `LOAD` runs it.
 */

const MODEL_TVC = 8;
/** A BASIC program file (the type BASIC's own SAVE writes) */
const TVC_PROGRAM_FILE_TYPE = 0x01;

/** The format a TVC build exports as by default: `.cas` for `.model TVC`, or no model on a running TVC */
export function tvcExportFormatOf(modelType: number | undefined, machineId: string | undefined): "cas" | undefined {
  if (modelType === MODEL_TVC) return "cas";
  if (modelType === undefined && machineId === MI_TVC) return "cas";
  return undefined;
}

/**
 * The bytes of a `.cas` for a build
 * @returns the file's bytes, or the reason the build cannot be exported
 */
export function tvcExportFile(build: { segments: TvcSegment[]; entryAddress?: number }): { data: Uint8Array } | { error: string } {
  const placement = placeTvcCode(build.segments, build.entryAddress);
  if (isTvcPlacementProblem(placement)) return { error: describeTvcPlacementProblem(placement) };
  return { data: buildTvcCasFile(tvcProgramPayload(placement), TVC_PROGRAM_FILE_TYPE, true) };
}

/** Why a TVC build cannot be exported in a format of another machine, or undefined */
export function tvcFormatProblem(format: string | undefined): string | undefined {
  if (!format || format === "cas" || format === "hex") return undefined;
  return t("commands.compile.tvcFormat", { format });
}
