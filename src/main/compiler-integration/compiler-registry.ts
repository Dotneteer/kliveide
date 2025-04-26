import type { AssemblerErrorInfo, BinarySegment, CompilerOutput, FileLine, ListFileItem } from "@abstractions/CompilerInfo";
import { ISourceFileItem } from "@main/z80-compiler/assembler-types";

/**
 * Stores the compilers
 */
let compilerRegistry: Record<string, IKliveCompiler> = {};

/**
 * Any compiler should be able to retrieve simple error information
 */
export type SimpleAssemblerOutput = {
  failed?: string;
  errors?: AssemblerErrorInfo[];
  debugMessages?: string[];
  traceOutput?: string[];
};

/**
 * Represents a compiler that can generate injectable code
 */
export type InjectableOutput = SimpleAssemblerOutput & {
  readonly segments: BinarySegment[];
  injectOptions: Record<string, boolean>;
  sourceType?: string;
};

export type DebuggableOutput = InjectableOutput & {
  /**
   * The source files involved in this compilation, in
   * their file index order
   */
  readonly sourceFileList: ISourceFileItem[];

  /**
   * Source map information that assigns source file info with
   * the address
   */
  readonly sourceMap: Record<number, FileLine>;

  /**
   * Items of the list file
   */
  readonly listFileItems: ListFileItem[];

};

/**
 * Output of a Klive compiler
 */
export type KliveCompilerOutput =
  | SimpleAssemblerOutput
  | InjectableOutput
  | DebuggableOutput
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
  compileFile(filename: string, options?: Record<string, any>): Promise<KliveCompilerOutput>;

  /**
   * Checks if the specified file can have a breakpoint
   * @param line The line content to check
   */
  lineCanHaveBreakpoint(line: string): Promise<boolean>;
}

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
