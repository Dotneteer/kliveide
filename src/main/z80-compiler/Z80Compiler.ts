import {
  IKliveCompiler,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import { CompilerOptions } from "@abstractions/z80-compiler-service";
import { getZ80CompilerService } from "@core/service-registry";

/**
 * Wraps the built-in Klive Z80 Compiler
 */
export class Z80Compiler implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id = "Z80Compiler";

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
  async compileFile(
    filename: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput> {
    return getZ80CompilerService().compileFile(
      filename,
      options as CompilerOptions
    );
  }

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compile(
    sourceText: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput> {
    return getZ80CompilerService().compile(
      sourceText,
      options as CompilerOptions
    );
  }
}
