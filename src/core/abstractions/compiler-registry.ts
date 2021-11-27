import { AssemblerErrorInfo, CompilerOutput } from "./z80-compiler-service";

/**
 * Stores the compilers
 */
let compilerRegistry: Record<string, IKliveCompiler> = {};
let compilerExtensions: Record<string, string> = {};

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
   * The compiler receives a standard message
   * @param data Message data
   */
  onMessage(data: any): Promise<void>;

  /**
   * The compiler receives an error message
   * @param data Message data
   */
  onErrorMessage(data: any): Promise<void>;

  /**
   * Tests if the specified code is an error code
   * @param exitCode 
   */
  exitCodeIsError(exitCode: number): boolean;
}

/**
 * Type guard that checks if the specified output is coming from the Z80 Assembler
 * @param output
 * @returns
 */
export function isCompoundCompilerOutput(
  output: KliveCompilerOutput
): output is CompilerOutput {
  return (output as any)?.segments && (output as any)?.sourceItem;
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

/**
 * Registers a file extension to work with a particular compiler
 * @param compilerId Compiler identifier
 * @param extension File extension to use with the compiler
 */
export function registerCompilerExtension(
  compilerId: string,
  extension: string
): void {
  if (!getCompiler(compilerId)) {
    // --- No compiler to register the extension with
    return;
  }

  // --- Register the extension
  compilerExtensions[extension] = compilerId;
}

/**
 * Gets the compiler for the specified file extension
 * @param extension File extension
 * @returns Compiler instance, if there is a registered compiler; otherwise, undefined.
 */
export function getCompilerForExtension(
  extension: string
): IKliveCompiler | undefined {
  return compilerExtensions[extension]
    ? getCompiler(compilerExtensions[extension])
    : undefined;
}
