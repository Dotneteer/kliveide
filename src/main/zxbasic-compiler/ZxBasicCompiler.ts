import {
  IKliveCompiler,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import { createZxbCommandLineArgs, execZxbc} from "./zxb-runner";

/**
 * Wraps the built-in Klive Z80 Compiler
 */
export class ZxBasicCompiler implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id = "ZXBCompiler";

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
    // --- Create the command line arguments
    const outFilename = `${filename}.kz80.asm`;
    const cmdLine = await createZxbCommandLineArgs(filename, outFilename, null);

    // --- Run the compiler
    try {
      await execZxbc(cmdLine);
      console.log("Success");
    } catch (err) {
      console.log(err.toString());
    }
    return {
      errors: [],
    };
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
    throw new Error("Not supported");
  }
}
