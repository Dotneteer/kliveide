import fs from "fs";

import type {
  BinarySegment,
  IKliveCompiler,
  InjectableOutput,
  KliveCompilerOutput
} from "../../common/abstractions/CompilerInfo";
import type { ErrorFilterDescriptor } from "../../main/cli-integration/CliRunner";

import { createSettingsReader } from "../../common/utils/SettingsReader";
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
  ZXBC_PYTHON_PATH,
  ZXBC_SINCLAIR,
  ZXBC_STRICT_BOOL,
  ZXBC_STRICT_MODE
} from "./zxb-config";
import { AppState } from "../../common/state/AppState";
import { CliRunner } from "../../main/cli-integration/CliRunner";
import { SpectrumModelType } from "../../main/z80-compiler/SpectrumModelTypes";

/**
 * Wraps the ZXBC (ZX BASIC) compiler
 */
export class ZxBasicCompiler implements IKliveCompiler {
  private state: AppState;

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
  async compileFile(filename: string): Promise<KliveCompilerOutput> {
    const settingsReader = createSettingsReader(this.state);
    try {
      // --- Obtain configuration info for ZXBC
      const execPath = settingsReader.readSetting(ZXBC_EXECUTABLE_PATH)?.toString();
      if (!execPath || execPath.trim() === "") {
        throw new Error("ZXBC executable path is not set, cannot start the compiler.");
      }
      const pythonPath = settingsReader.readSetting(ZXBC_PYTHON_PATH)?.toString();

      // --- Create the command line arguments
      const outFilename = `${filename}.bin`;
      const labelFilename = `${filename}.lab`;

      const args = await createCommandLineArgs(filename, outFilename, labelFilename);
      const runner = new CliRunner();
      runner.setErrorFilter(this.getErrorFilterDescription());
      const result = await runner.execute(execPath, args, {
        env: pythonPath ? { ...process.env, PATH: pythonPath } : { ...process.env }
      });

      if (result.failed || result.errors?.length > 0) {
        return result;
      }

      // --- Extract the output
      const org = settingsReader.readSetting(ZXBC_MACHINE_CODE_ORIGIN);
      const machineCode = new Uint8Array(fs.readFileSync(outFilename));

      // --- Extract the labels
      const segment: BinarySegment = {
        emittedCode: Array.from(machineCode),
        startAddress: typeof org === "number" ? org & 0xffff : 0x8000
      };

      // --- Remove the output files
      try {
        fs.unlinkSync(outFilename);
        fs.unlinkSync(labelFilename);
      } catch {
        // --- Intentionally ignored
      }

      // --- Done.
      return {
        traceOutput: null, //result.traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        segments: [segment],
        modelType: SpectrumModelType.Spectrum48
      } as InjectableOutput;
    } catch (err) {
      throw err;
    }

    /**
     * Generates the command-line arguments to run ZXBC.EXE
     * @param inputFile Source file to compile
     * @param outputFile Output file to generate
     * @param labelFile Lable file to generate
     * @param rawArgs Raw arguments from the code
     */
    async function createCommandLineArgs(
      inputFile: string,
      outputFile: string,
      labelFile: string
    ): Promise<string[]> {
      const args: string[] = [inputFile, "--output", outputFile, "--mmap", labelFile];
      const arrayBaseOne = !!settingsReader.readSetting(ZXBC_ONE_AS_ARRAY_BASE_INDEX);
      if (arrayBaseOne) {
        args.push("--array-base=1");
      }
      const optimize = settingsReader.readSetting(ZXBC_OPTIMIZATION_LEVEL) as number;
      args.push("--optimize", `${optimize ?? 2}`);
      const orgValue = settingsReader.readSetting(ZXBC_MACHINE_CODE_ORIGIN) as number;
      args.push("--org", `${orgValue ?? 0x8000}`);
      const heapSize = settingsReader.readSetting(ZXBC_HEAP_SIZE) as number;
      args.push("--heap-size", `${heapSize ?? 4096}`);
      const sinclair = settingsReader.readSetting(ZXBC_SINCLAIR) as boolean;
      if (sinclair) {
        args.push("--sinclair");
      }
      const stringBaseOne = !!settingsReader.readSetting(ZXBC_ONE_AS_STRING_BASE_INDEX);
      if (stringBaseOne) {
        args.push("--string-base=1");
      }
      const debugMemory = !!settingsReader.readSetting(ZXBC_DEBUG_MEMORY);
      if (debugMemory) {
        args.push("--debug-memory");
      }
      const debugArray = !!settingsReader.readSetting(ZXBC_DEBUG_ARRAY);
      if (debugArray) {
        args.push("--debug-array");
      }
      const strictBool = !!settingsReader.readSetting(ZXBC_STRICT_BOOL);
      if (strictBool) {
        args.push("--strict-bool");
      }
      const strictMode = !!settingsReader.readSetting(ZXBC_STRICT_MODE);
      if (strictMode) {
        args.push("--strict");
      }
      const enableBreak = !!settingsReader.readSetting(ZXBC_ENABLE_BREAK);
      if (enableBreak) {
        args.push("--enable-break");
      }
      const explicit = !!settingsReader.readSetting(ZXBC_EXPLICIT_VARIABLES);
      if (explicit) {
        args.push("--explicit");
      }
      return args;
    }
  }

  /**
   * Checks if the specified file can have a breakpoint
   * @param line The line content to check
   */
  async lineCanHaveBreakpoint(_line: string): Promise<boolean> {
    return false;
  }

  /**
   * Optionally forwards the current state to the compiler
   * @param state State to forward to the compiler
   */
  setAppState(state: AppState): void {
    this.state = state;
  }

  /**
   * Gets the error filter description
   */
  getErrorFilterDescription(): ErrorFilterDescriptor {
    return {
      regex: /^(.*):(\d+): error: (.*)$/,
      filenameFilterIndex: 1,
      lineFilterIndex: 2,
      messageFilterIndex: 3
    };
  }
}
