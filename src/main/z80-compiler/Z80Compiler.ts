import { AssemblerErrorInfo, CompilerOptions } from "@/common/abstractions/IZ80CompilerService";
import { KliveCompilerOutput, isAssemblerError } from "../compiler-integration/compiler-registry";
import { Z80CompilerService } from "./z80-compiler-service";
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
    async compileFile(
      filename: string,
      options?: Record<string, any>
    ): Promise<KliveCompilerOutput> {
      const output = await new Z80CompilerService().compileFile(
        filename,
        options as CompilerOptions
      );
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