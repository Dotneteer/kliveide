import fs from "fs";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { CliManager } from "@main/cli-integration/CliManager";
import {
  CmdLineOptionSet,
  CompilerResult,
  ErrorFilterDescriptor,
  OptionResult
} from "@main/cli-integration/CliRunner";
import { mainStore } from "@main/main-store";
import { SJASMP_INSTALL_FOLDER } from "@main/sjasmp-integration/sjasmp-config";

export const SJASM_OUTPUT_FILE = "_output.bin";
export const SJASM_LIST_FILE = "_output.txt";

const SjasmOptions: CmdLineOptionSet = {
  help: {
    optionName: "h",
    description: "Help information",
    type: "boolean"
  },
  version: {
    optionName: "-version",
    description: "Basic info (with --nologo only raw version string)",
    type: "boolean"
  },
  zxnext: {
    optionName: "-zxnext",
    description:
      'Enable ZX Next Z80 extensions (CSpect emulator has extra "exit", ' +
      '"break", "clrbrk" and "setbrk" fake instructions)',
    type: "string"
  },
  i8080: {
    optionName: "-i8080",
    description: "Limit valid instructions to i8080 only (+ no fakes)",
    type: "boolean"
  },

  // --- CPU targeting options
  lr35902: {
    optionName: "-lr35902",
    description: "Sharp LR35902/SM83 CPU instructions mode (+ no fakes)",
    type: "boolean"
  },
  outprefix: {
    optionName: "-outprefix",
    description:
      "Prefix for save/output/.. filenames in directives. Note: " +
      "if prefix is folder, it must already exist and add trailing " +
      "slash. Prefix is applied only to filenames defined in source " +
      "(not to CLI arguments).",
    type: "string"
  },
  inc: {
    optionName: "-i",
    description: "Include path",
    type: "string"
  },
  lst: {
    optionName: "-lst",
    description: "Save listing to <filename> (<source>.lst is default)",
    type: "string"
  },
  lstlab: {
    optionName: "-lstlab",
    description: "Append [sorted] symbol table to listing",
    type: "string"
  },
  sym: {
    optionName: "-sym",
    description: "Save symbol table to <filename>",
    type: "string"
  },
  exp: {
    optionName: "-exp",
    description: "Save exports to <filename> (see EXPORT pseudo-op)",
    type: "string"
  },
  raw: {
    optionName: "-raw",
    description: "Machine code saved also to <filename> (- is STDOUT)",
    type: "string"
  },
  sld: {
    optionName: "-sld",
    description:
      "Save Source Level Debugging data to <filename> Default name is: " +
      '"<first input filename>.sld.txt"',
    type: "string"
  },
  nologo: {
    optionName: "-nologo",
    description: "Do not show startup message",
    type: "boolean"
  },
  msg: {
    optionName: "-msg",
    description: 'Stderr messages verbosity ("all" is default)',
    type: "string"
  },
  fullpath: {
    optionName: "-fullpath",
    description:
      "Input file paths: full | CWD relative | name only " +
      '(*) Note: --fullpath without value is "rel" (relative ' +
      "to current working directory)",
    type: "string"
  },
  color: {
    optionName: "-color",
    description: "Enable or disable ANSI coloring of warnings/errors",
    type: "string"
  },
  longptr: {
    optionName: "-longptr",
    description: "No device: program counter $ can go beyond 0x10000",
    type: "boolean"
  },
  reversepop: {
    optionName: "-reversepop",
    description: "Enable reverse POP order (as in base SjASM version)",
    type: "boolean"
  },
  dirbol: {
    optionName: "-dirbol",
    description: "Enable directives processing from the beginning of line",
    type: "boolean"
  },
  nofakes: {
    optionName: "-nofakes",
    description: "Disable fake instructions (same as --syntax=F)",
    type: "boolean"
  },
  dos866: {
    optionName: "-dos866",
    description: "Encode from Windows codepage to DOS 866 (Cyrillic)",
    type: "boolean"
  },
  syntax: {
    optionName: "-syntax",
    description: "Adjust parsing syntax",
    type: "string"
  }
};

/**
 * ZCC wrapper to invoke the ZCC process
 */
class SjasmCliManager extends CliManager {
  private readonly _files: string[] = [];
  private _rootPath: string;

  /**
   * Prefix used with options
   */
  get optionPrefix(): string {
    return "-";
  }

  /**
   * Creates a new ZCC instance
   * @param cwd Current working directory
   * @param options Compiler options
   * @param files Files to compile
   * @param overwriteOptions Should the options overwrite the default ones?
   */
  constructor(
    cwd: string,
    options: Record<string, any> = {},
    files: string[] = [],
    overwriteOptions = false,
    private readonly defines: Record<string, string> = {},
    private readonly warnings: string[] = []
  ) {
    super(cwd, SjasmOptions, options, overwriteOptions);
    this._files = files;
  }

  private getRootPath(): string {
    if (!this._rootPath) {
      const settingsReader = createSettingsReader(mainStore);
      this._rootPath = settingsReader.readSetting(SJASMP_INSTALL_FOLDER);
    }
    if (!this._rootPath) {
      throw new Error(
        "SjasmPlus install folder is not set. Use the sjasm-reset command to specify it."
      );
    }
    return this._rootPath;
  }

  /**
   * Prepares the command name
   */
  protected prepareCommand(): string {
    return `${this.getRootPath()}/sjasmplus`;
  }

  /**
   * Define the default options that may override the provided options
   */
  protected defaultOptions(): Record<string, any> {
    // --- Implement in a derived class
    const options: Record<string, any> = {
      raw: SJASM_OUTPUT_FILE,
      lst: SJASM_LIST_FILE,
    };
    Object.entries(this.defines).forEach((value, key) => {
      options[`D${key}`] = value;
    });
    this.warnings.forEach((value) => {
      if (value.startsWith("!")) {
        options[`Wno-${value.substring(1)}`] = true;
      } else {
        options[`W${value}`] = true;
      }
    });
    return options;
  }

  /**
   * Carry out any additional activities before the command execution
   */
  protected setupBeforeExecute(): void {
    // --- Implement in a derived class
    const outFile = `${this.cwd}/${SJASM_OUTPUT_FILE}`;
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
    }
  }

  /**
   * Evaluate the output of the command
   * @param result Result of the command execution
   */
  protected evaluateOutput(result: CompilerResult): void {
    const outFile = `${this.cwd}/${SJASM_OUTPUT_FILE}`;
    result.outFile = outFile;
    try {
      result.contents = fs.readFileSync(outFile);
    } catch (err) {
      // --- Intentionally ignore this error
    }
  }

  /**
   * Transform the command line arguments
   * @param options Options to transform
   */
  protected transformCmdLineArgs(options: OptionResult): OptionResult {
    if (this._files?.length) {
      this._files.forEach((file) => options.args.push(file));
    }
    return options;
  }

  /**
   * Adds a file to the compilation list
   * @param file File to add to the compilation list
   */
  addFile(file: string): void {
    this._files.push(file);
  }

  /**
   * Gets the error filter description
   */
  getErrorFilterDescription(): ErrorFilterDescriptor {
    return {
      regex: /^(.*)\((\d+)\): (warning|error): (.*)$/,
      hasLineInfo: (match: RegExpMatchArray) => match?.[2] !== undefined,
      filenameFilterIndex: 1,
      lineFilterIndex: 2,
      messageFilterIndex: 4,
      warningFilterIndex: 3
    };
  }
}

// --- The result of option composition
export const createSjasmRunner = (
  cwd: string,
  options: Record<string, any> = {},
  files: string[] = [],
  overwriteOptions = false
) => new SjasmCliManager(cwd, options, files, overwriteOptions);
