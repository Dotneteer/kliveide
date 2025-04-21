import fs from "fs";
import type {
  IKliveCompiler,
  InjectableOutput,
  KliveCompilerOutput
} from "@main/compiler-integration/compiler-registry";
import type { ErrorFilterDescriptor } from "@main/cli-integration/CliRunner";

import { BinarySegment, SpectrumModelType } from "@abstractions/CompilerInfo";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { mainStore } from "../main-store";
import { SJASMP_INSTALL_FOLDER, SJASMP_KEEP_TEMP_FILES } from "./sjasmp-config";
import {
  createSjasmRunner,
  SJASM_LIST_FILE,
  SJASM_OUTPUT_FILE
} from "../../script-packages/sjasm/sjasm";

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
      const options: Record<string, any> = {
        nologo: true,
        fullpath: "on"
      };

      const state = mainStore.getState();
      const cliManager = createSjasmRunner(state.project?.folderPath, options, [filename]);
      const result = await cliManager.execute();

      if (result.failed || result.errors?.length > 0) {
        return result;
      }

      // --- Extract the map file
      const listFileName = `${state.project.folderPath}/${SJASM_LIST_FILE}`;
      const listContent = fs.readFileSync(listFileName, "utf-8");
      const codeSegments = extractSegmentsFromListFile(listContent);
      const binaryFileName = `${state.project.folderPath}/${SJASM_OUTPUT_FILE}`;
      const binaryContent = new Uint8Array(fs.readFileSync(binaryFileName));

      const segments: BinarySegment[] = [];
      let binIndex = 0;
      for (const segment of codeSegments) {
        segments.push({
          emittedCode: Array.from(binaryContent.slice(binIndex, binIndex + segment.size)),
          startAddress: segment.origin
        });
        binIndex += segment.size;
      }

      // --- Remove the output files
      try {
        const keepTempFiles = settingsReader.readBooleanSetting(SJASMP_KEEP_TEMP_FILES);
        if (!keepTempFiles) {
          fs.unlinkSync(listFileName);
          fs.unlinkSync(binaryFileName);
        }
      } catch {
        // --- Intentionally ignored
      }

      // --- Done.
      return {
        traceOutput: result.traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        segments,
        modelType: SpectrumModelType.Spectrum48
      } as InjectableOutput;
    } catch (err) {
      throw err;
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

export function extractSegmentsFromListFile(content: string): SegmentInfo[] {
  const regex = /^\s*\d+\+*\s+([0-9A-Fa-f]{4})\s+((?:[0-9A-Fa-f]{2}\s*){0,4})(.*)$/;
  const result: SegmentInfo[] = [];

  // --- Split the content into lines
  const lines = content.split(/\r?\n/);
  let prevStartAddress = -1;
  let lastAddress = -1;
  let lastOpcodesLength = 0;

  // --- Process each line
  for (const line of lines) {
    // --- Skip lines starting with "#"
    if (line.startsWith("#")) {
      continue;
    }

    // Test the line against the regex
    const match = line.match(regex);
    if (!match) {
      continue; // Skip lines that do not match the expected format
    }

    // Extract the address, instruction codes, and instruction
    const address = parseInt(match[1], 16); // Convert the address from hex to a number
    const instructionCodes = match[2].trim(); // Get the instruction codes
    const instruction = match[3].trim(); // Get the instruction part

    // Check with a regex if the instruction starts with "org" (case-insensitive)
    const orgRegex = /:?(\s*)org\s+/i;
    if (orgRegex.test(instruction)) {
      // --- Close the previous segment
      if (prevStartAddress !== -1) {
        const size = lastAddress - prevStartAddress;
        if (size > 0) {
          result.push({ origin: prevStartAddress, size });
        }
        prevStartAddress = -1;
      }
      lastAddress = -1;
      continue;
    }

    // --- Get the number of instruction codes
    lastOpcodesLength = instructionCodes ? instructionCodes.split(/\s+/).length : 0;

    if (lastAddress === -1) {
      // --- First address
      lastAddress = prevStartAddress = address;
    }

    // --- Update the last address
    lastAddress = address + lastOpcodesLength;
  }

  // --- We may have a last segment
  if (lastAddress > prevStartAddress) {
    const size = lastAddress - prevStartAddress;
    if (size > 0) {
      result.push({ origin: prevStartAddress, size });
    }
  }

  return result;
}

type SegmentInfo = {
  origin: number;
  size: number;
};
