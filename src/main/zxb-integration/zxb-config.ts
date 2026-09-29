import type { AppState } from "@common/state/AppState";

import { createSettingsReader } from "@common/utils/SettingsReader";

export const ZXBC_ALL = "zxbasic";
export const ZXBC_EXECUTABLE_PATH = "zxbasic.executablePath";
export const ZXBC_PYTHON_PATH = "zxbasic.pythonPath";
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
export const ZXBC_STRICT_BOOL = "zxbasic.strictBoolean";
export const ZXBC_STORE_GENERATED_ASM = "zxbasic.storeGeneratedAsm";
/** Which compiler builds `.bas` files: "klive" (Klive BASIC, the default) or "zxbc" (the external ZX BASIC compiler). */
export const ZXBC_COMPILER = "zxbasic.compiler";

export type ZxBasicCompilerChoice = "klive" | "zxbc";

/**
 * The compiler the `zxbasic.compiler` setting selects: Klive BASIC unless it says `zxbc` (plan §12.1,
 * D9: the default switched to Klive BASIC at the end of Phase 4). The main process's dispatcher and
 * the renderer's background compile both ask this.
 */
export function selectedZxBasicCompiler(state: AppState | undefined): ZxBasicCompilerChoice {
  const value = state ? createSettingsReader(state).readSetting(ZXBC_COMPILER) : undefined;
  return typeof value === "string" && value.trim().toLowerCase() === "zxbc" ? "zxbc" : "klive";
}
