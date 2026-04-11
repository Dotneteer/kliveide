import { CompilerOutput, DebuggableOutput, KliveCompilerOutput, SourceLevelDebugInfo } from "@abstractions/CompilerInfo";

/**
 * Type guard that checks if the specified output can be used for code injection
 * @param output
 * @returns
 */
export function isInjectableCompilerOutput(output: KliveCompilerOutput): output is CompilerOutput {
  return (output as any)?.segments;
}

/**
 * Type guard that checks if the specified output can be used for code injection
 * @param output
 * @returns
 */
export function isDebuggableCompilerOutput(output: KliveCompilerOutput): output is CompilerOutput {
  return (output as any)?.segments && (output as any)?.sourceFileList;
}

/**
 * Type guard: checks whether the compiler output contains source-level
 * debug information (SourceLevelDebugInfo), enabling statement-level stepping.
 */
export function hasSourceLevelDebug(
  output: KliveCompilerOutput
): output is DebuggableOutput & { sourceLevelDebug: SourceLevelDebugInfo } {
  return isDebuggableCompilerOutput(output) && !!(output as DebuggableOutput).sourceLevelDebug;
}
