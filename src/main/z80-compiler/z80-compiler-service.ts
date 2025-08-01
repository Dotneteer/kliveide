import type { CompilerOptions, CompilerOutput } from "@abstractions/CompilerInfo";

import { Z80Assembler } from "./z80-assembler";
import { AssemblerOptions } from "../compiler-common/assembler-in-out";

/**
 * This class implements the operations of the Z80 Compiler service
 */
export class Z80CompilerService {
  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compileFile(filename: string, options?: CompilerOptions): Promise<CompilerOutput> {
    const assembler = new Z80Assembler();
    return (await assembler.compileFile(
      filename,
      options as AssemblerOptions
    )) as unknown as CompilerOutput;
  }
}
