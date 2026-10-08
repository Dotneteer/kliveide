import fs from "fs";
import type { ErrorFilterDescriptor } from "@main/cli-integration/CliRunner";

import {
  AssemblerErrorInfo,
  BinarySegment,
  DebuggableOutput,
  ExpressionValueType,
  SourceAnnotation,
  FileLine,
  IKliveCompiler,
  KliveCompilerOutput,
  ListFileItem,
} from "@abstractions/CompilerInfo";
import { createSettingsReader } from "@common/utils/SettingsReader";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_ZXNEXT
} from "@common/machines/constants";
import { SJASMP_KEEP_TEMP_FILES } from "./sjasmp-config";
import {
  resolveSjasmplusExecutable,
  sjasmplusNotWorkingMessage,
  SJASMPLUS_NOT_CONFIGURED_MESSAGE
} from "./sjasmplus-resolver";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import {
  createSjasmRunner,
  SJASM_LIST_FILE,
  SJASM_OUTPUT_FILE,
  SJASM_SLD_FILE
} from "../../script-packages/sjasm/sjasm";
import { AppState } from "@common/state/AppState";
import { ISourceFileItem } from "@main/compiler-common/abstractions";
import {
  ANNOTATION_KEYWORDS,
  SLDOPT_ALL_KEYWORDS,
  annotationsInComment,
  type AnnotationKeyword
} from "@common/utils/source-annotations";

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
      const execPath = resolveSjasmplusExecutable(settingsReader);
      if (!execPath) {
        throw new Error(SJASMPLUS_NOT_CONFIGURED_MESSAGE);
      }
      // --- Settings survive whatever happens to the disk: the install folder may
      // --- have been renamed, moved or removed since it was set up. Say so in
      // --- the words the integration dialog uses, rather than letting the spawn
      // --- fail with an ENOENT nobody can act on.
      if (!fs.existsSync(execPath)) {
        throw new Error(sjasmplusNotWorkingMessage(execPath));
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

      // --- The device decides whether an SLD page is a partition (`.plans/PROFILER_PLAN.md` D8b)
      const sourceContent = fs.readFileSync(filename, "utf-8");
      const modelType = getSjasmModelType(sourceContent, this.state?.emulatorState?.machineId);
      const banked = sldPagesArePartitions(modelType);

      // --- Transform the SLD file content into debug information
      const sourceFileList: ISourceFileItem[] = [];
      const sourceMap: Record<number, FileLine> = {};
      const sourceFileHash: Record<string, number> = {};
      const listFileItems: ListFileItem[] = [];

      // --- Iterate through lines
      const fileIndexOf = (filename: string) => {
        let fileIndex = sourceFileHash[filename];
        if (fileIndex === undefined) {
          // --- Yes, a new file
          fileIndex = sourceFileList.length;
          sourceFileList[fileIndex] = { filename, includes: [] };
          sourceFileHash[filename] = fileIndex;
        }
        return fileIndex;
      };
      for (let i = 0; i < sldLines.length; i++) {
        const line = sldLines[i];

        if (line.type !== "T") {
          // --- Process only trace lines here; labels and keyword comments below
          continue;
        }
        const fileIndex = fileIndexOf(line.filename);

        // --- Map the address
        sourceMap[line.value] = { fileIndex, line: line.line };
        listFileItems.push({
          address: line.value,
          fileIndex,
          lineNumber: line.line,
          ...(banked && line.page >= 0 ? { partition: line.page } : {})
        });
      }

      // --- Labels (`L` lines) and DeZog keyword comments (`K` lines), `.plans/LOGPOINTS_PLAN.md` §4.7
      const symbols = sldSymbols(sldLines, { banked, fileIndexOf });
      const debugAnnotations = sldAnnotations(sldLines, fileIndexOf);

      // --- Remove the output files
      removeTempFiles();

      // --- A keyword in the sources with no `K` line of its kind: sjasmplus dropped it for want of
      // --- SLDOPT (LOGPOINTS_PLAN Q6; extended to ASSERTION and WPMEM, S9)
      const warnings: AssemblerErrorInfo[] = [];
      const exported = new Set(debugAnnotations.map((a) => a.kind));
      const files = new Set([filename, ...sourceFileList.map((f) => f.filename)]);
      const missing = new Map<string, string>();
      for (const f of files) {
        let content: string;
        try {
          content = fs.readFileSync(f, "utf-8");
        } catch {
          continue;
        }
        for (const kind of annotationKindsInSource(content)) {
          if (!exported.has(kind) && !missing.has(kind)) missing.set(kind, f);
        }
      }
      if (missing.size) {
        warnings.push(sldoptWarning([...missing.values()][0], [...missing.keys()]));
      }

      // --- Done.
      return {
        traceOutput: result.traceOutput,
        debugMessages: result.debugMessages,
        errors: warnings,
        injectOptions: { subroutine: true },
        // --- Names the compiler in the profiler's routine header (`.plans/PROFILER_PLAN.md` D6)
        sourceType: "sjasmp",
        segments,
        modelType,
        sourceFileList,
        sourceMap,
        listFileItems,
        symbols,
        debugAnnotations
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

export function getSjasmModelType(
  sourceContent: string,
  fallbackMachineId?: string
): SpectrumModelType {
  const deviceMatch = sourceContent.match(/^\s*device\s+([^\s;]+)/im);
  const deviceName = deviceMatch?.[1]?.toLowerCase();

  switch (deviceName) {
    case "zxspectrum128":
    case "zxspectrum128k":
      return fallbackMachineId === MI_SPECTRUM_3E
        ? SpectrumModelType.SpectrumP3
        : SpectrumModelType.Spectrum128;
    case "zxspectrumnext":
    case "zxspectrum_next":
    case "zxnext":
      return SpectrumModelType.Next;
    case "zxspectrum16":
    case "zxspectrum16k":
    case "zxspectrum48":
    case "zxspectrum48k":
      return SpectrumModelType.Spectrum48;
  }

  switch (fallbackMachineId) {
    case MI_SPECTRUM_128:
      return SpectrumModelType.Spectrum128;
    case MI_SPECTRUM_3E:
      return SpectrumModelType.SpectrumP3;
    case MI_ZXNEXT:
      return SpectrumModelType.Next;
    case MI_SPECTRUM_48:
    default:
      return SpectrumModelType.Spectrum48;
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
      // --- The data field is the last one and may itself hold `|`: a `K` line's comment can be a
      // --- logpoint like `${A | B}`
      data: parts.slice(7).join("|").trim()
    });
  }

  // --- Done.
  return result;
}

/** sjasmplus `L`-line traits of names that are not values a program reads. */
const NON_VALUE_TRAITS = new Set(["+macro", "+module", "+endmod", "+struct_def", "+sizeof"]);

/**
 * Whether an SLD line's `page` names a Klive partition (`.plans/PROFILER_PLAN.md` D8b): with the
 * 128K, +3 and Next devices a page is a 16K bank (128K, +3) or an 8K page (Next) - exactly those
 * machines' partitions. The 48K device's pages are its fixed slots, which name no partition.
 */
export function sldPagesArePartitions(modelType: SpectrumModelType): boolean {
  return (
    modelType === SpectrumModelType.Spectrum128 ||
    modelType === SpectrumModelType.SpectrumP3 ||
    modelType === SpectrumModelType.Next
  );
}

/** The Klive assembler's `SymbolType`s an SLD symbol maps to (`CompilerInfo.ts`) */
const SYMBOL_LABEL = 1;
const SYMBOL_VAR = 2;
const SYMBOL_EQU = 3;

/**
 * The integer symbols of an SLD file's `L` lines (`.plans/LOGPOINTS_PLAN.md` Q7), keyed lower-case
 * by module, main and local name joined with dots - the full global name DeZog expects labels to be
 * written with. Shaped like the Klive assembler's symbol table, so conditions, logpoints and the
 * Watch panel read it the same way. The deprecated `F` and `D` lines are read as `L` ones.
 *
 * `type` follows the Klive assembler's (`.plans/PROFILER_PLAN.md` D8a): a label (`L`, `F`) is a
 * Label, so the Execution History and the profiler see it; `+equ` is an Equ and a `D` line a Var,
 * which neither treats as a code address. A label with a local part (`main.local`) is `isLocal`: it
 * never starts a routine. With `banked`, a label's page is its partition (D8b).
 */
export function sldSymbols(
  lines: SldLine[],
  options: { banked?: boolean; fileIndexOf?: (filename: string) => number } = {}
): Record<string, unknown> {
  const symbols: Record<string, unknown> = {};
  for (const line of lines) {
    if (line.type !== "L" && line.type !== "F" && line.type !== "D") continue;
    if (!Number.isFinite(line.value)) continue;
    const [module = "", main = "", local = "", ...traits] = line.data.split(",");
    if (traits.some((t) => NON_VALUE_TRAITS.has(t.trim()))) continue;
    const name = [module, main, local]
      .map((part) => part.trim())
      .filter((part) => part)
      .join(".");
    if (!name) continue;
    const isEqu = traits.some((t) => t.trim() === "+equ");
    const type = line.type === "D" ? SYMBOL_VAR : isEqu ? SYMBOL_EQU : SYMBOL_LABEL;
    symbols[name.toLowerCase()] = {
      name,
      type,
      value: { _type: ExpressionValueType.Integer, _value: line.value },
      ...(local.trim() ? { isLocal: true } : {}),
      ...(options.banked && type === SYMBOL_LABEL && line.page >= 0 ? { partition: line.page } : {}),
      ...(options.fileIndexOf && line.filename
        ? { definitionFileIndex: options.fileIndexOf(line.filename), definitionLine: line.line }
        : {})
    };
  }
  return symbols;
}

/**
 * The DeZog annotations of an SLD file's `K` lines - `LOGPOINT`, `ASSERTION` and `WPMEM` - the
 * comment, with the address decoded exactly as the `T` lines' is.
 */
export function sldAnnotations(
  lines: SldLine[],
  fileIndexOf: (filename: string) => number
): SourceAnnotation[] {
  const result: SourceAnnotation[] = [];
  for (const line of lines) {
    if (line.type !== "K" || !Number.isFinite(line.value)) continue;
    for (const { kind, text } of annotationsInComment(line.data)) {
      result.push({
        kind,
        fileIndex: fileIndexOf(line.filename),
        line: line.line,
        address: line.value & 0xffff,
        text
      });
    }
  }
  return result;
}

/** The DeZog keywords a source's comments hold. A cheap line test, for the `SLDOPT` warning. */
export function annotationKindsInSource(source: string): Set<AnnotationKeyword> {
  const kinds = new Set<AnnotationKeyword>();
  for (const line of source.split(/\r?\n/)) {
    const comment = line.indexOf(";");
    const slashes = line.indexOf("//");
    const start = comment < 0 ? slashes : slashes < 0 ? comment : Math.min(comment, slashes);
    if (start < 0) continue;
    for (const { kind } of annotationsInComment(line.substring(start))) kinds.add(kind);
  }
  return kinds;
}

/** Does a source hold `LOGPOINT` in a comment? */
export function sourceHasLogpointComment(source: string): boolean {
  return annotationKindsInSource(source).has("LOGPOINT");
}

/**
 * The warning when sjasmplus exported none of the comments of some kinds the sources have (Q6, S9).
 * It names the full `SLDOPT` line; the IDE never adds it itself.
 */
export function sldoptWarning(
  filename: string,
  kinds: string[] = ["LOGPOINT"]
): AssemblerErrorInfo {
  const ordered = ANNOTATION_KEYWORDS.filter((k) => kinds.includes(k));
  return {
    errorCode: "LP002",
    filename,
    line: 1,
    startPosition: 0,
    endPosition: null,
    startColumn: 0,
    endColumn: null,
    message:
      `${ordered.join(", ")} comments are ignored: add ${SLDOPT_ALL_KEYWORDS} ` +
      "to the source to use DeZog's source comments",
    isWarning: true
  };
}

type SegmentInfo = {
  origin: number;
  size: number;
};

export type SldLine = {
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
