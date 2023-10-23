import {
  AssemblerErrorInfo,
  BinarySegment,
  SpectrumModelType
} from "../../common/abstractions/IZ80CompilerService";
import { createSettingsReader } from "../../common/utils/SettingsReader";
import { CompilerBase } from "../compiler-integration/CompilerBase";
import { KliveCompilerOutput } from "../compiler-integration/compiler-registry";
import { mainStore } from "../main-store";
import * as fs from "fs";
import {
  ZXBC_DEBUG_ARRAY,
  ZXBC_DEBUG_MEMORY,
  ZXBC_ENABLE_BREAK,
  ZXBC_EXECUTABLE_PATH,
  ZXBC_EXPLICIT_VARIABLES,
  ZXBC_HEAP_SIZE,
  ZXBC_MACHINE_CODE_ORIGIN,
  ZXBC_ONE_AS_ARRAY_BASE_INDEX,
  ZXBC_ONE_AS_STRING_BASE_INDEX,
  ZXBC_OPTIMIZATION_LEVEL,
  ZXBC_SINCLAIR,
  ZXBC_STRICT_BOOL,
  ZXBC_STRICT_MODE
} from "./zxb-config";

/**
 * Wraps the ZXBC (ZX BASIC) compiler
 */
export class ZxBasicCompiler extends CompilerBase {
  /**
   * The unique ID of the compiler
   */
  readonly id = "ZXBCompiler";

  /**
   * Compiled language
   */
  readonly language = "zxbas";

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
  async compileFile (
    filename: string,
    beforeTraces?: string[],
    aftertraces?: string[],
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput> {
    const settingsReader = createSettingsReader(mainStore);
    try {
      // --- Obtain configuration info for ZXBC
      const execPath = settingsReader
        .readSetting(ZXBC_EXECUTABLE_PATH)
        ?.toString();
      if (!execPath || execPath.trim() === "") {
        throw new Error(
          "ZXBC executable path is not set, cannot start the compiler."
        );
      }

      // --- Create the command line arguments
      const outFilename = `${filename}.bin`;
      const cmdLine = await createZxbCommandLineArgs(
        filename,
        outFilename,
        null
      );
      beforeTraces.push("Invoking ZX BASIC compiler");
      beforeTraces.push(cmdLine);

      // --- Run the compiler
      const compileOut = await this.executeCommandLine(execPath, cmdLine);
      if (compileOut) {
        if (typeof compileOut === "string") {
          console.log("here", compileOut);
          return {
            failed: compileOut
          };
        }

        const errors = compileOut.filter(
          i => typeof i !== "string"
        ) as AssemblerErrorInfo[];
        if (errors?.length > 0) {
          return {
            errors,
            debugMessages: compileOut.filter(
              i => typeof i === "string"
            ) as string[]
          };
        }
      }

      // --- Extract the output
      const org = settingsReader.readSetting(ZXBC_MACHINE_CODE_ORIGIN);
      const machineCode = new Uint8Array(fs.readFileSync(outFilename));
      const segment: BinarySegment = {
        emittedCode: Array.from(machineCode),
        startAddress: typeof org === "number" ? org & 0xffff : 0x8000
      };

      // --- Remove the output file
      fs.unlinkSync(outFilename);

      // --- Done.
      return {
        errors: [],
        injectOptions: { subroutine: true },
        segments: [segment],
        modelType: SpectrumModelType.Spectrum48
      };
    } catch (err) {
      throw err;
    }

    /**
     * Generates the command-line arguments to run ZXBC.EXE
     * @param outputFile Output file to generate
     * @param rawArgs Raw arguments from the code
     */
    async function createZxbCommandLineArgs (
      inputFile: string,
      outputFile: string,
      rawArgs: string | null
    ): Promise<string> {
      const settingsReader = createSettingsReader(mainStore);
      const argRoot = `${inputFile} --output ${outputFile} `;
      let additional = rawArgs ? rawArgs.trim() : "";
      if (!additional) {
        const arrayBaseOne = !!settingsReader.readSetting(
          ZXBC_ONE_AS_ARRAY_BASE_INDEX
        );
        additional = arrayBaseOne ? "--array-base=1 " : "";
        const optimize = settingsReader.readSetting(
          ZXBC_OPTIMIZATION_LEVEL
        ) as number;
        additional += `--optimize ${optimize ?? 2} `;
        const orgValue = settingsReader.readSetting(
          ZXBC_MACHINE_CODE_ORIGIN
        ) as number;
        additional += `--org ${orgValue ?? 0x8000} `;
        const heapSize = settingsReader.readSetting(ZXBC_HEAP_SIZE) as number;
        additional += `--heap-size ${heapSize ?? 4096} `;
        const sinclair = settingsReader.readSetting(ZXBC_SINCLAIR) as boolean;
        additional += sinclair ? "--sinclair " : "";
        const stringBaseOne = !!settingsReader.readSetting(
          ZXBC_ONE_AS_STRING_BASE_INDEX
        );
        additional += stringBaseOne ? "--string-base=1 " : "";
        const debugMemory = !!settingsReader.readSetting(ZXBC_DEBUG_MEMORY);
        additional += debugMemory ? "--debug-memory " : "";
        const debugArray = !!settingsReader.readSetting(ZXBC_DEBUG_ARRAY);
        additional += debugArray ? "--debug-array " : "";
        const strictBool = !!settingsReader.readSetting(ZXBC_STRICT_BOOL);
        additional += strictBool ? "--strict-bool " : "";
        const strictMode = !!settingsReader.readSetting(ZXBC_STRICT_MODE);
        additional += strictMode ? "--strict " : "";
        const enableBreak = !!settingsReader.readSetting(ZXBC_ENABLE_BREAK);
        additional += enableBreak ? "--enable-break " : "";
        const explicit = !!settingsReader.readSetting(ZXBC_EXPLICIT_VARIABLES);
        additional += explicit ? "--explicit " : "";
      }
      return (argRoot + additional).trim();
    }
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  processErrorMessage (data: string): string | AssemblerErrorInfo {
    // --- Split segments and search for "error" or "warning"
    const segments = data.split(":").map(s => s.trim());
    let isWarning = false;
    let keywordIdx = segments.indexOf("error");
    if (keywordIdx < 0) {
      keywordIdx = segments.indexOf("warning");
      isWarning = keywordIdx >= 0;
    }

    // --- Ok, we found an error or a warning.
    // --- Try to parse the rest of the message
    if (keywordIdx < 2 || keywordIdx >= segments.length - 1) {
      return data;
    }

    // --- Extract other parts
    const line = parseInt(segments[keywordIdx - 1]);
    if (isNaN(line)) {
      return data;
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
    return {
      fileName,
      line,
      message,
      startColumn: 0,
      endColumn: 0,
      startPosition: 0,
      endPosition: 0,
      errorCode,
      isWarning
    };
  }
}
