import {
  isAssemblerError,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import {
  AssemblerErrorInfo,
  CompilerOptions,
} from "@abstractions/z80-compiler-service";
import { getZ80CompilerService } from "@core/service-registry";
import { CompilerBase } from "../compiler-integration/CompilerBase";

/**
 * Wraps the built-in Klive Z80 Compiler
 */
export class Z80Compiler extends CompilerBase {
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
    const output = await getZ80CompilerService().compileFile(
      filename,
      options as CompilerOptions
    );
    if (output.errors.length) {
      for (const error of output.errors) {
        await this.onErrorMessage(error);
      }
    }
    return output;
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  processErrorMessage(data: any): string | AssemblerErrorInfo {
    if (isAssemblerError(data)) {
      return data;
    }
    return data.toString();
  }
}
