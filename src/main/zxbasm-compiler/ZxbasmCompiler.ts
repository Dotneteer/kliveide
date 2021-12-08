import {
  isAssemblerError,
  KliveCompilerOutput,
  SimpleAssemblerOutput,
} from "@abstractions/compiler-registry";
import {
  AssemblerErrorInfo,
  BinarySegment,
} from "@abstractions/z80-compiler-service";
import { getSettingsService } from "@core/service-registry";
import {
  ZXBASM_EXECUTABLE_PATH,
  ZXBASM_OPTIMIZATION_LEVEL,
} from "@modules/integration-zxbasm/zxbasm-config";
import { readFileSync, unlinkSync } from "original-fs";
import { CompilerBase } from "../compiler-integration/CompilerBase";

/**
 * Wraps the ZXBASM Compiler (Boriel's Basic Assembler)
 */
export class ZxbasmCompiler extends CompilerBase {
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
      const compileOut = await this.executeCommandLine(execPath, cmdLine);
      if (compileOut) {
        const errors = compileOut.filter(
          (i) => typeof i !== "string"
        ) as AssemblerErrorInfo[];
        if (errors.length > 0) {
          return {
            errors,
            debugMessages: compileOut.filter(
              (i) => typeof i === "string"
            ) as string[],
          };
        }
      }

      // --- Extract the ORG of the compilation
      let orgAddress: number | undefined;
      if (compileOut) {
        const debugOut = compileOut.filter(i => typeof i === "string") as string[];
        for (const outEntry of debugOut) {
          if (outEntry.startsWith("debug:")) {
            const sqrPos = outEntry.indexOf("[") - 6;
            if (sqrPos >= 0) {
              const addr = parseInt(outEntry.substr(sqrPos, 4), 16);
              if (!isNaN(addr)) {
                orgAddress = addr;
              }
            }
          }
        }
      }
      const debugMessages: string[] | undefined = orgAddress === undefined
        ? ["Cannot extract ORG address from code, $8000 is assumed."]
        : undefined;

      // --- Extract the output
      const machineCode = new Uint8Array(readFileSync(outFilename));
      const segment: BinarySegment = {
        emittedCode: Array.from(machineCode),
        startAddress: orgAddress ?? 0x8000,
      };

      // --- Remove the output file
      unlinkSync(outFilename);

      // --- Done.
      return {
        errors: [],
        debugMessages,
        injectOptions: { subroutine: true },
        segments: [segment],
      };
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
      if (!additional) {
        const optimize = configObject.get(ZXBASM_OPTIMIZATION_LEVEL) as number;
        additional += `--optimize ${optimize ?? 2} `;
      }
      // --- Temporary
      additional += `-d`;
      return (argRoot + additional).trim();
    }
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  processErrorMessage(data: any): string | AssemblerErrorInfo {
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

    // --- Done.
    const errorInfo: AssemblerErrorInfo = {
      fileName,
      line,
      message,
      startColumn: 0,
      endColumn: 0,
      startPosition: 0,
      endPosition: 0,
      errorCode: "ERROR",
      isWarning,
    };
    return errorInfo;
  }
}
