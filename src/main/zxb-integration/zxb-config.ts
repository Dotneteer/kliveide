import type { AppState } from "@common/state/AppState";

import { createSettingsReader } from "@common/utils/SettingsReader";

export const ZXBC_ALL = "zxbasic";
export const ZXBC_EXECUTABLE_PATH = "zxbasic.executablePath";
export const ZXBC_OPTIMIZATION_LEVEL = "zxbasic.optimizationLevel";
export const ZXBC_MACHINE_CODE_ORIGIN = "zxbasic.machineCodeOrigin";
export const ZXBC_SINCLAIR = "zxbasic.sinclair";
export const ZXBC_ONE_AS_ARRAY_BASE_INDEX = "zxbasic.oneAsArrayBaseIndex";
export const ZXBC_ONE_AS_STRING_BASE_INDEX = "zxbasic.oneAsStringBaseIndex";
export const ZXBC_HEAP_SIZE = "zxbasic.heapSize";
export const ZXBC_DEBUG_MEMORY = "zxbasic.debugMemory";
export const ZXBC_DEBUG_ARRAY = "zxbasic.debugArray";
export const ZXBC_ENABLE_BREAK = "zxbasic.enableBreak";
export const ZXBC_EXPLICIT_VARIABLES = "zxbasic.explicitVariables";
export const ZXBC_STRICT_MODE = "zxbasic.strictMode";
/**
 * Which compiler builds `.zxbas`/`.bas` files: "klive" (Klive BASIC, the default) or "boriel" (the
 * external Boriel BASIC 2.x, `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` B1). A user or project setting.
 */
export const ZXBC_COMPILER = "zxbasic.compiler";

export type ZxBasicCompilerChoice = "klive" | "boriel";

/**
 * The compiler the `zxbasic.compiler` setting selects: Boriel BASIC for "boriel", and for "zxbc", the
 * value the removed 1.x integration used, so a user who chose the external compiler keeps one;
 * Klive BASIC for anything else. The main process's dispatcher and the renderer both ask this.
 */
export function selectedZxBasicCompiler(state: AppState | undefined): ZxBasicCompilerChoice {
  return compilerChoiceOf(state ? createSettingsReader(state).readSetting(ZXBC_COMPILER) : undefined);
}

/** The compiler a `zxbasic.compiler` value selects. */
export function compilerChoiceOf(value: unknown): ZxBasicCompilerChoice {
  const choice = typeof value === "string" ? value.trim().toLowerCase() : "";
  return choice === "boriel" || choice === "zxbc" ? "boriel" : "klive";
}
