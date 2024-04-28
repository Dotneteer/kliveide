import { IKliveCompiler, KliveCompilerOutput } from "./compiler-registry";
import { AssemblerErrorInfo } from "@abstractions/IZ80CompilerService";
import { __DARWIN__, __LINUX__ } from "../../electron/electron-utils";
import { CommandLineInvoker } from "./CommandLineInvoker";

/**
 * Helper class to invoke compilers and communicate with the IDE
 */
export abstract class CompilerBase extends CommandLineInvoker implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  abstract readonly id: string;

  /**
   * Compiled language
   */
  abstract readonly language: string;

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput = true;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  abstract compileFile(
    filename: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput>;

  /**
   * Processes the message data and returns as a string
   * @param data
   */
  processMessage (data: string): string {
    return data;
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  abstract processErrorMessage(data: string): AssemblerErrorInfo | string;
}
