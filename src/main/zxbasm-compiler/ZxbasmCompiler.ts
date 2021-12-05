import {
  isAssemblerError,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import {
  AssemblerErrorInfo,
  BinarySegment,
} from "@abstractions/z80-compiler-service";
import { getSettingsService } from "@core/service-registry";
import { ZXBASM_EXECUTABLE_PATH } from "@modules/integration-zxbasm/zxbasm-config";
import { readFileSync, unlinkSync } from "original-fs";
import { CompilerBase } from "../compiler-integration/CompilerBase";

/**
 * Wraps the ZXBASM Compiler (Boriel's Basic Assembler)
 */
export class ZxbasmCompiler extends CompilerBase {
  private _errors: AssemblerErrorInfo[];

  /**
   * The unique ID of the compiler
   */
  readonly id = "ZxbAsmCompiler";

    /**
   * Compiled language
   */
  readonly language = "zxbasm";


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
    try {
      // --- Obtain configuration info for ZXBC
      const configObject = await getSettingsService().getConfiguration(
        "current"
      );
      const execPath = configObject.get(ZXBASM_EXECUTABLE_PATH) as string;
      if (!execPath || execPath.trim() === "") {
        throw new Error(
          "ZXBASM executable path is not set, cannot start the compiler."
        );
      }

      // --- Create the command line arguments
      const outFilename = `${filename}.bin`;
      const cmdLine = await createZxbasmCommandLineArgs(
        filename,
        outFilename,
        null
      );

      // --- Run the compiler
      this._errors = [];
      await this.executeCommandLine(execPath, cmdLine);

      // TODO: Extract the binary output

      // --- Remove the output file
      unlinkSync(outFilename);

      // --- Done.
      throw new Error("Not implemented yet")
      // return {
      //   errors: this._errors,
      //   injectOptions: { "subroutine": true },
      //   segments: [segment],
      // };
    } catch (err) {
      throw err;
    }

    /**
     * Generates the command-line arguments to run ZXBC.EXE
     * @param outputFile Output file to generate
     * @param rawArgs Raw arguments from the code
     */
    async function createZxbasmCommandLineArgs(
      inputFile: string,
      outputFile: string,
      rawArgs: string | null
    ): Promise<string> {
      const configObject = await getSettingsService().getConfiguration(
        "current"
      );
      const argRoot = `${inputFile} --output ${outputFile} `;
      let additional = rawArgs ? rawArgs.trim() : "";
      return (argRoot + additional).trim();
    }
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  processErrorMessage(data: any): string | AssemblerErrorInfo {
    if (isAssemblerError(data)) {
      if (!data.isWarning) {
        this._errors.push(data);
      }
      return data;
    }

    // --- Split segments and search for "error" or "warning"
    const dataStr = data.toString() as string;
    const segments = dataStr.split(":").map((s) => s.trim());
    let isWarning = false;
    let keywordIdx = segments.indexOf("error");
    if (keywordIdx < 0) {
      keywordIdx = segments.indexOf("warning");
      isWarning = keywordIdx >= 0;
    }

    // --- Ok, we found an error or a warning.
    // --- Try to parse the rest of the message
    if (keywordIdx < 2 || keywordIdx >= segments.length - 1) {
      return dataStr;
    }

    // --- Extract other parts
    const line = parseInt(segments[keywordIdx - 1]);
    if (isNaN(line)) {
      return dataStr;
    }
    const fileName = segments.slice(0, keywordIdx - 1).join(":");
    let message = segments
      .slice(keywordIdx + 1)
      .join(":")
      .trim();
    const bracketPos = message.indexOf("]");
    let errorCode = "ERR";
    if (bracketPos >= 0) {
      errorCode = message.slice(1, bracketPos);
      message = message.slice(bracketPos + 1).trim();
    }

    // --- Done.
    const errorInfo: AssemblerErrorInfo = {
      fileName,
      line,
      message,
      startColumn: 0,
      endColumn: 0,
      startPosition: 0,
      endPosition: 0,
      errorCode,
      isWarning,
    };
    if (!isWarning) {
      this._errors.push(errorInfo);
    }
    return errorInfo;
  }

  /**
   * Tests if the specified code is an error code
   * @param exitCode
   */
  exitCodeIsError(exitCode: number): boolean {
    return exitCode === 1 && this._errors.length === 0;
  }
}
