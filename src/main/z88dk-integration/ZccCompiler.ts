import {
  AssemblerErrorInfo,
  BinarySegment,
  SpectrumModelType,
} from "../../common/abstractions/IZ80CompilerService";
import { createSettingsReader } from "../../common/utils/SettingsReader";
import { CompilerBase } from "../compiler-integration/CompilerBase";
import {
  InjectableOutput,
  KliveCompilerOutput,
} from "../compiler-integration/compiler-registry";
import { mainStore } from "../main-store";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { Z88DK_INSTALL_FOLDER } from "./z88dk-config";
import { createZccRunner } from "../../script-packages/z88dk/Zcc";

/**
 * Wraps the ZXBC (ZX BASIC) compiler
 */
export class ZccCompiler extends CompilerBase {
  /**
   * The unique ID of the compiler
   */
  readonly id = "ZCCCompiler";

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
    const zccRunner = createZccRunner(
      "zx",
      {
        startup: 31,
      },
      [filename],
    );
    const cmdLine = zccRunner.getCommandLineString();
    const traceOutput = [`Executing ${cmdLine}`];

    try {
      // --- Run the compiler
      const compileOut = await this.executeCommandLine(cmdLine, "");
      fs.writeFileSync(
        path.join(app.getPath("home"), "klive-compile.log"),
        JSON.stringify(compileOut, null, 2),
      );
      if (compileOut) {
        if (typeof compileOut === "string") {
          return {
            traceOutput,
            failed: compileOut,
          };
        }

        const errors = compileOut.filter(
          (i) => typeof i !== "string",
        ) as AssemblerErrorInfo[];
        if (errors?.length > 0) {
          return {
            traceOutput,
            errors,
            debugMessages: compileOut.filter(
              (i) => typeof i === "string",
            ) as string[],
          };
        }
      }

      // --- Extract the output
      // const org = settingsReader.readSetting(ZXBC_MACHINE_CODE_ORIGIN);
      // const machineCode = new Uint8Array(fs.readFileSync(outFilename));

      // // --- Extract the labels
      // const labelList = fs.readFileSync(labelFilename, "utf8");
      // const segment: BinarySegment = {
      //   emittedCode: Array.from(machineCode),
      //   startAddress: typeof org === "number" ? org & 0xffff : 0x8000,
      // };

      // --- Remove the output files
      // try {
      //   fs.unlinkSync(outFilename);
      //   fs.unlinkSync(labelFilename);
      // } catch {
      //   // --- Intentionally ignored
      // }

      // --- Done.
      return {
        traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        segments: [], // [segment],
        modelType: SpectrumModelType.Spectrum48,
      } as InjectableOutput;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  processErrorMessage(data: string): string | AssemblerErrorInfo {
    // --- Split segments and search for "error" or "warning"
    const segments = data.split(":").map((s) => s.trim());
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
      isWarning,
    };
  }
}

async function createZ88DkCommandLineArgs(filename: string): Promise<string> {
  return "zcc";
}
