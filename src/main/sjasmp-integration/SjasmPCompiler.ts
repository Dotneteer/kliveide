import fs from "fs";
import type { ErrorFilterDescriptor } from "../../main/cli-integration/CliRunner";

import {
  BinarySegment,
  DebuggableOutput,
  FileLine,
  IKliveCompiler,
  KliveCompilerOutput,
  ListFileItem,
} from "../../common/abstractions/CompilerInfo";
import { createSettingsReader } from "../../common/utils/SettingsReader";
import { SJASMP_INSTALL_FOLDER, SJASMP_KEEP_TEMP_FILES } from "./sjasmp-config";
import {
  createSjasmRunner,
  SJASM_LIST_FILE,
  SJASM_OUTPUT_FILE,
  SJASM_SLD_FILE
} from "../../script-packages/sjasm/sjasm";
import { AppState } from "../../common/state/AppState";
import { ISourceFileItem } from "../../main/compiler-common/abstractions";

/**
 * Wraps the SjasmPlus compiler
 */
export class SjasmPCompiler implements IKliveCompiler {
  private state: AppState;

  /**
   * The unique ID of the compiler
   */
  readonly id = "SjasmPCompiler";

  /**
   * Compiled language
   */
  readonly language = "sjasmp";

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput = true;

  /**
   * Optionally forwards the current state to the compiler
   * @param state State to forward to the compiler
   */
  setAppState(state: AppState): void {
    this.state = state;
  }

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
      // --- Obtain configuration info for SjasmPlus
      const execPath = settingsReader.readSetting(SJASMP_INSTALL_FOLDER)?.toString();
      if (!execPath || execPath.trim() === "") {
        throw new Error("SjasmPlus executable path is not set, cannot start the compiler.");
      }

      // --- Create the command line arguments
      const options: Record<string, any> = {
        nologo: true,
        fullpath: "on"
      };

      const state = this.state;
      const cliManager = createSjasmRunner(
        state,
        state.project?.folderPath.replaceAll("\\", "/"),
        options,
        [filename]
      );
      const result = await cliManager.execute();

      // --- Extract and process the list file's content
      const listFileName = `${state.project.folderPath}/${SJASM_LIST_FILE}`;
      const binaryFileName = `${state.project.folderPath}/${SJASM_OUTPUT_FILE}`;
      const sldFileName = `${state.project.folderPath}/${SJASM_SLD_FILE}`;

      if (result.failed || result.errors?.length > 0) {
        removeTempFiles();
        return result;
      }

      const listContent = fs.readFileSync(listFileName, "utf-8");
      const codeSegments = extractSegmentsFromListFile(listContent);

      // --- Extract the binary content
      const binaryContent = new Uint8Array(fs.readFileSync(binaryFileName));

      // --- Extract the segments of the binary code
      const segments: BinarySegment[] = [];
      let binIndex = 0;
      for (const segment of codeSegments) {
        segments.push({
          emittedCode: Array.from(binaryContent.slice(binIndex, binIndex + segment.size)),
          startAddress: segment.origin
        });
        binIndex += segment.size;
      }

      // --- Extract the SLD file content
      const sldLines = extractSldInfo(fs.readFileSync(sldFileName, "utf-8"));

      // --- Transform the SLD file content into debug information
      const sourceFileList: ISourceFileItem[] = [];
      const sourceMap: Record<number, FileLine> = {};
      const sourceFileHash: Record<string, number> = {};
      const listFileItems: ListFileItem[] = [];

      // --- Iterate through lines
      for (let i = 0; i < sldLines.length; i++) {
        const line = sldLines[i];

        if (line.type !== "T") {
          // --- Process only trace lines
          continue;
        }

        // --- A new file?
        let fileIndex = sourceFileHash[line.filename];
        if (fileIndex === undefined) {
          fileIndex = sourceFileList.length;
          // --- Yes, a new file
          sourceFileList[fileIndex] = {
            filename: line.filename,
            includes: []
          };
          sourceFileHash[line.filename] = fileIndex;
        }

        // --- Map the address
        sourceMap[line.value] = { fileIndex, line: line.line };
        listFileItems.push({
          address: line.value,
          fileIndex,
          lineNumber: line.line
        });
      }

      // --- Remove the output files
      removeTempFiles();

      // --- Done.
      return {
        traceOutput: result.traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        segments,
        modelType: 1, // Spectrum 48
        sourceFileList,
        sourceMap,
        listFileItems
      } as DebuggableOutput;

      function removeTempFiles() {
        // --- Remove the output files
        try {
          const keepTempFiles = settingsReader.readBooleanSetting(SJASMP_KEEP_TEMP_FILES);
          if (!keepTempFiles) {
            fs.unlinkSync(listFileName);
            fs.unlinkSync(binaryFileName);
            fs.unlinkSync(sldFileName);
          }
        } catch {
          // --- Intentionally ignored
        }
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Checks if the specified file can have a breakpoint
   * @param line The line content to check
   */
  async lineCanHaveBreakpoint(line: string): Promise<boolean> {
    // Regular expression to match an optional label followed by the first instruction
    const regex = /^([\._$@`A-Za-z][_@$!?\.0-9A-Za-z]*:?)?\s*([_$A-Za-z][_$0-9A-Za-z]*\+?)?\s*/;

    // Test the line against the regex
    const match = line.match(regex);
    if (!match) {
      return false; // No instruction found
    }

    // The third capturing group contains the first instruction
    const keyword = match[2];
    return !!keyword && !restrictedNodes.includes(keyword.toLowerCase());
  }

  /**
   * Gets the error filter description
   */
  getErrorFilterDescription(): ErrorFilterDescriptor {
    return {
      regex: /^(.*)\((\d+)\):\s+(warning|error):\s+(.*)$/,
      filenameFilterIndex: 1,
      lineFilterIndex: 2,
      messageFilterIndex: 4,
      warningFilterIndex: 3
    };
  }
}

export function extractSegmentsFromListFile(content: string): SegmentInfo[] {
  const regex = /^\s*\d+\+*\s+([0-9A-Fa-f]{4})\s+((?:[0-9A-Fa-f]{2}(\s|$)){0,4})(.*)$/;
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
    const instruction = match[4].trim(); // Get the instruction part

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

export function extractSldInfo(content: string): SldLine[] {
  // --- Split the content into lines
  const lines = content.split(/\r?\n/);
  const result: SldLine[] = [];

  // --- Process each line except the first line
  for (const line of lines.slice(1)) {
    if (line.startsWith("||")) {
      // --- Skip lines starting with "||", these lines are comments
      continue;
    }

    // --- Split the line into parts
    const parts = line.split("|");
    if (parts.length < 8) {
      // --- Skip lines that do not have enough parts
      continue;
    }

    result.push({
      filename: parts[0].trim(),
      line: parseInt(parts[1].trim(), 10),
      defFile: parts[2].trim(),
      defLine: parseInt(parts[3].trim(), 10),
      page: parseInt(parts[4].trim(), 10),
      value: parseInt(parts[5].trim(), 10),
      type: parts[6].trim(),
      data: parts[7].trim()
    });
  }

  // --- Done.
  return result;
}

type SegmentInfo = {
  origin: number;
  size: number;
};

type SldLine = {
  filename: string;
  line: number;
  defFile: string;
  defLine: number;
  page: number;
  value: number;
  type: string;
  data: string;
};

const restrictedNodes: string[] = [
  "align",
  "assert",
  "binary",
  "bplist",
  "cspectmap",
  "defdevice",
  "define",
  "defl",
  "dephase",
  "device",
  "disp",
  "display",
  "dup",
  "edup",
  "emptytap",
  "emptytrd",
  "encoding",
  "end",
  "endlua",
  "endmod",
  "endmodule",
  "endt",
  "ent",
  "equ",
  "export",
  "fpos",
  "incbin",
  "inchob",
  "include",
  "includelua",
  "inctrd",
  "insert",
  "labelslist",
  "lua",
  "memorymap",
  "mmu",
  "module",
  "opt",
  "org",
  "outend",
  "output",
  "page",
  "phase",
  "relocate_end",
  "relocate_start",
  "relocate_table",
  "rept",
  "save3dos",
  "saveasmdos",
  "savebin",
  "savecdt",
  "savepcsna",
  "savecpr",
  "savedev",
  "savehob",
  "savenex",
  "savesna",
  "savetap",
  "savetrd",
  "setbp",
  "setbreakpoint",
  "shellexec",
  "size",
  "sldopt",
  "slot",
  "tapend",
  "tapout",
  "textarea",
  "undefine",
  "unphase",
  "while"
];
