import type { CompilerOptions } from "@abstractions/CompilerInfo";
import type {
  IKliveCompiler,
  KliveCompilerOutput
} from "@main/compiler-integration/compiler-registry";

import { Z80CompilerService } from "./z80-compiler-service";

/**
 * Wraps the built-in Klive Z80 Compiler
 */
export class Z80Compiler implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id = "Z80Compiler";

  /**
   * Compiled language
   */
  readonly language = "kz80-asm";

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
  async compileFile(filename: string, options?: Record<string, any>): Promise<KliveCompilerOutput> {
    const output = await new Z80CompilerService().compileFile(filename, options as CompilerOptions);
    return output;
  }
}
