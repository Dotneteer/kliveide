import type {
  IKliveCompiler,
  InjectableOutput,
  KliveCompilerOutput
} from "@main/compiler-integration/compiler-registry";
import type { ErrorFilterDescriptor } from "@main/cli-integration/CliRunner";

import { SpectrumModelType } from "@abstractions/CompilerInfo";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { mainStore } from "../main-store";
import { SJASMP_INSTALL_FOLDER } from "./sjasmp-config";
import { createSjasmRunner } from "../../script-packages/sjasm/sjasm";

/**
 * Wraps the SjasmPlus compiler
 */
export class SjasmPCompiler implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  readonly id = "SjasmPCompiler";

  /**
   * Compiled language
   */
  readonly language = "sjasm";

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
    const settingsReader = createSettingsReader(mainStore);
    try {
      // --- Obtain configuration info for ZXBC
      const execPath = settingsReader.readSetting(SJASMP_INSTALL_FOLDER)?.toString();
      if (!execPath || execPath.trim() === "") {
        throw new Error("SjasmPlus executable path is not set, cannot start the compiler.");
      }

      // --- Create the command line arguments
      const outFilename = `${filename}.bin`;
      const labelFilename = `${filename}.lab`;

      const options: Record<string, any> = {
        nologo: true,
      }

      const state = mainStore.getState();
      const cliManager = createSjasmRunner(state.project?.folderPath, options, [filename]);
      const result = await cliManager.execute();
      console.log(result);


      if (result.failed || result.errors?.length > 0) {
        return result;
      }

      // --- Extract the output
      //   const org = settingsReader.readSetting(ZXBC_MACHINE_CODE_ORIGIN);
      //   const machineCode = new Uint8Array(fs.readFileSync(outFilename));

      //   // --- Extract the labels
      //   const segment: BinarySegment = {
      //     emittedCode: Array.from(machineCode),
      //     startAddress: typeof org === "number" ? org & 0xffff : 0x8000
      //   };

      //   // --- Remove the output files
      //   try {
      //     fs.unlinkSync(outFilename);
      //     fs.unlinkSync(labelFilename);
      //   } catch {
      //     // --- Intentionally ignored
      //   }

      // --- Done.
      return {
        traceOutput: result.traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        // TODO: return the compiled code
        segments: [],
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
      // TODO: implement the command line arguments  
      const args: string[] = [];
      const settingsReader = createSettingsReader(mainStore);
      return args;
    }
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
