import { CompilerOutput, KliveCompilerOutput } from "../abstractions/CompilerInfo";

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
