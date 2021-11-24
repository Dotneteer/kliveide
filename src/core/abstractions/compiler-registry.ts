import { AssemblerErrorInfo, CompilerOutput } from "./z80-compiler-service";

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
 * Output of a Klive compiler
 */
export type KliveCompilerOutput = SimpleAssemblerOutput | CompilerOutput;

/**
 * Defines the responsibilities of a compiler that can vork directly with a build root
 */
export interface IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id: string;

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

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compile(
    sourceText: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput>;
}

/**
 * Type guard that checks if the specified output is coming from the Z80 Assembler
 * @param output
 * @returns
 */
export function isCompoundOutput(
  output: KliveCompilerOutput
): output is CompilerOutput {
  return (output as any).segments && (output as any).sourceItem;
}

/**
 * Registers the specified compiler
 * @param compiler Compiler to register
 */
export function registerCompiler(compiler: IKliveCompiler): void {
  compilerRegistry[compiler.id] = compiler;
}

/**
 * Gets the specified Klive compiler
 * @param id Compiler ID
 */
export function getCompiler(id: string): IKliveCompiler | undefined {
  return compilerRegistry[id];
}
