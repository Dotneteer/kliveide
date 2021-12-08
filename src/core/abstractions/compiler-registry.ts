import {
  AssemblerErrorInfo,
  BinarySegment,
  CompilerOutput,
} from "./z80-compiler-service";

/**
 * Stores the compilers
 */
let compilerRegistry: Record<string, IKliveCompiler> = {};

/**
 * Any compiler should be able to retrieve simple error information
 */
export type SimpleAssemblerOutput = {
  errors?: AssemblerErrorInfo[];
};

/**
 * Represents a compiler that can generate injectable code
 */
export type InjectableOutput = SimpleAssemblerOutput & {
  readonly segments: BinarySegment[];
  injectOptions: Record<string, boolean>;
  sourceType?: string;
};

/**
 * Output of a Klive compiler
 */
export type KliveCompilerOutput =
  | SimpleAssemblerOutput
  | InjectableOutput
  | CompilerOutput;

/**
 * Defines the responsibilities of a compiler that can vork directly with a build root
 */
export interface IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id: string;

  /**
   * Compiled language
   */
  readonly language: string;

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput: boolean;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(
    filename: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput>;
}

/**
 * Tests if the specified data is AssemblerErrorInfo
 * @param data Data to test
 */
export function isAssemblerError(data: any): data is AssemblerErrorInfo {
  return !!data.errorCode && !!data.fileName;
}

/**
 * Type guard that checks if the specified output can be used for code injection
 * @param output
 * @returns
 */
export function isInjectableCompilerOutput(
  output: KliveCompilerOutput
): output is CompilerOutput {
  return (output as any)?.segments;
}

/**
 * Type guard that checks if the specified output can be used for code injection
 * @param output
 * @returns
 */
export function isDebuggableCompilerOutput(
  output: KliveCompilerOutput
): output is CompilerOutput {
  return (output as any)?.segments && (output as any)?.sourceFileList;
}

/**
 * Registers the specified compiler
 * @param compiler Compiler to register
 */
export function registerCompiler(compiler: IKliveCompiler): void {
  compilerRegistry[compiler.language] = compiler;
}

/**
 * Gets the specified Klive compiler
 * @param id Compiler ID
 */
export function getCompiler(id: string): IKliveCompiler | undefined {
  return compilerRegistry[id];
}
