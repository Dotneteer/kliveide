import { CmdLineOptionDescriptor, CmdLineOptionSet } from "../OptionDescriptor";

const ZccOptions: CmdLineOptionSet = {
  // --- General options
  help: {
    optionName: "h",
    description: "Display this help",
    type: "boolean"
  },
  verbose: {
    optionName: "v",
    description: "Output all commands that are run (-vn suppresses)",
    type: "boolean"
  },
  output: {
    optionName: "o",
    description: "Set the basename for linker output files",
    type: "string"
  },
  specs: {
    optionName: "specs",
    description: "Print out compiler specs",
    type: "boolean"
  },

  // --- CPU targeting options
  m8080: {
    description: "Generate output for the Intel 8080 CPU",
    type: "boolean"
  },
  m8085: {
    description: "Generate output for the Intel 8085 CPU",
    type: "boolean"
  },
  mz80: {
    description: "Generate output for the Zilog Z80 CPU",
    type: "boolean"
  },
  mz80_ixiy: {
    description: "Generate output for the Zilog Z80 CPU with IY/IY swap",
    type: "boolean"
  },
  mz80_strict: {
    description:
      "Generate output for the Zilog Z80 CPU with documented Z80 instruction set",
    type: "boolean"
  },
  mz80n: {
    description: "Generate output for the Z80N (Next) instruction set",
    type: "boolean"
  },
  mz180: {
    description: "Generate output for the Zilog Z180 CPU",
    type: "boolean"
  },
  mr2ka: {
    description: "Generate output for the Rabbit 2000 CPU",
    type: "boolean"
  },
  mr3k: {
    description: "Generate output for the Rabbit 3000 CPU",
    type: "boolean"
  },
  mr4k: {
    description: "Generate output for the Rabbit 4000 CPU",
    type: "boolean"
  },
  mgbz80: {
    description: "Generate output for the Gameboy Z80 CPU",
    type: "boolean"
  },
  mez80_z80: {
    description: "Generate output for the Zilog eZ80 in Z80 mode",
    type: "boolean"
  },
  mkc160: {
    description: "Generate output for the KC160 (Z80 mode) CPU",
    type: "boolean"
  },

  // --- Target options
  subType: {
    optionName: "subtype",
    description: "Set the target subtype",
    type: "string"
  },
  cLib: {
    optionName: "clib",
    description: "Set the target clib type",
    type: "string"
  },
  crt0: {
    description: "Override the crt0 assembler file to use",
    type: "string"
  },
  startupLib: {
    optionName: "startuplib",
    description: "Override STARTUPLIB - compiler base support routines",
    type: "string"
  },
  noCrt: {
    optionName: "no-crt",
    description: "Link without crt0 file",
    type: "boolean"
  },
  startupOffset: {
    optionName: "startupoffset",
    description: "Startup offset value (internal)",
    type: "number"
  },
  startup: {
    description: "Set the startup type",
    type: "number"
  },
  zOrg: {
    optionName: "zorg",
    description: "Set the origin (only certain targets)",
    type: "number"
  },
  noStdLib: {
    optionName: "nostdlib",
    description: "If set ignore INCPATH, STARTUPLIB",
    type: "boolean"
  },
  pragmaRedirect: {
    optionName: "pragma-redirect",
    description: "Redirect a function",
    type: "string",
    isArray: true
  },
  pragmaDefine: {
    optionName: "pragma-define",
    description: "Define the option in zcc_opt.def",
    type: "string",
    isArray: true
  },
  pragmaOutput: {
    optionName: "pragma-output",
    description: "Define the option in zcc_opt.def (same as pragma-define)",
    type: "string",
    isArray: true
  },
  pragmaExport: {
    optionName: "pragma-export",
    description: "Define the option in zcc_opt.def and export as public",
    type: "string",
    isArray: true
  },
  pragmaNeed: {
    optionName: "pragma-need",
    description: "NEED the option in zcc_opt.def",
    type: "string",
    isArray: true
  },
  pragmaBytes: {
    optionName: "pragma-bytes",
    description: "Dump a sequence of bytes zcc_opt.def",
    type: "string",
    isArray: true
  },
  pragmaString: {
    optionName: "pragma-string",
    description: "Dump a string zcc_opt.def",
    type: "string",
    isArray: true
  },
  pragmaInclude: {
    optionName: "pragma-include",
    description: "Process include file containing pragmas",
    type: "string",
    isArray: true
  },

  // --- Lifecycle options
  m4: {
    description: "Stop after processing m4 files",
    type: "boolean"
  },
  preprocessOnly: {
    optionName: "E",
    description: "Stop after preprocessing files",
    type: "boolean"
  },
  printMacroDefs: {
    optionName: "dD",
    description:
      "Print macro definitions in -E mode in addition to normal output",
    type: "boolean"
  },
  compileOnly: {
    optionName: "c",
    description: "Stop after compiling .c .s .asm files to .o files",
    type: "boolean"
  },
  assembleOnly: {
    optionName: "a",
    description: "Stop after compiling .c .s files to .asm files",
    type: "boolean"
  },
  makeLib: {
    optionName: "x",
    description: "Make a library out of source files",
    type: "boolean"
  },
  explicitC: {
    optionName: "xc",
    description: "Explicitly specify file type as C",
    type: "boolean"
  },
  createApp: {
    optionName: "create-app",
    description:
      "Run appmake on the resulting binary to create emulator usable file",
    type: "boolean"
  },

  // --- M4 options
  m4Opt: {
    optionName: "Cm",
    description: "Add an option to m4",
    type: "string",
    isArray: true
  },
  copyBackAfterM4: {
    optionName: "copy-back-after-m4",
    description: "Copy files back after processing with m4",
    type: "boolean"
  },

  // --- Preprocessor options
  addPreprocOpt: {
    optionName: "Cp",
    description: "Add an option to the preprocessor",
    type: "string",
    isArray: true
  },
  defPreprocOpt: {
    optionName: "D",
    description: "Define a preprocessor option",
    type: "string",
    isArray: true
  },
  undefPreprocOpt: {
    optionName: "U",
    description: "Undefine a preprocessor option",
    type: "string",
    isArray: true
  },
  includePath: {
    optionName: "I",
    description: "Add an include directory for the preprocessor",
    type: "string",
    isArray: true
  },
  includeQuote: {
    optionName: "iquote",
    description: "Add a quoted include path for the preprocessor",
    type: "string",
    isArray: true
  },
  includeSystem: {
    optionName: "isystem",
    description: "Add a system include path for the preprocessor",
    type: "string",
    isArray: true
  },

  // --- Compiler (all) options
  compiler: {
    description: "Set the compiler type from the command line (sccz80,sdcc)",
    type: "string"
  },
  cCodeInAsm: {
    optionName: "-c-code-in-asm",
    description: "Add C code to .asm files",
    type: "boolean"
  },
  optCodeSpeed: {
    optionName: "-opt-code-speed",
    description: "Optimize for code speed",
    type: "string",
    isArray: true
  },
  debug: {
    description: "Enable debugging support",
    type: "boolean"
  },

  // --- Compiler (sccz80) options
  sccz80Option: {
    optionName: "Cc",
    description: "Add an option to sccz80",
    type: "string",
    isArray: true
  },
  setR2LByDefault: {
    optionName: "set-r2l-by-default",
    description: "(sccz80) Use r2l calling convention by default",
    type: "boolean"
  },
  copt: {
    optionName: "O",
    description: "Set the peephole optimiser setting for copt",
    type: "number"
  },
  sccz80peepholeOpt: {
    optionName: "Ch",
    description: "Add an option to the sccz80 peepholer",
    type: "string",
    isArray: true
  },

  // --- Compiler (sdcc) options
  sdccOption: {
    optionName: "Cs",
    description: "Add an option to sdcc",
    type: "string",
    isArray: true
  },
  optCodeSize: {
    optionName: "opt-code-size",
    description: "Optimize for code size (sdcc only)",
    type: "number"
  },
  sdccPeepholeOpt: {
    optionName: "SO",
    description: "Set the peephole optimiser setting for sdcc-peephole",
    type: "number"
  },
  fsignedChar: {
    optionName: "fsigned-char",
    description: "Use signed chars by default",
    type: "boolean"
  },

  // --- Compiler (clang/llvm) options
  clangOption: {
    optionName: "Cg",
    description: "Add an option to clang",
    type: "string",
    isArray: true
  },
  clang: {
    description: "Stop after translating .c files to llvm ir",
    type: "boolean"
  },
  llvm: {
    description: "Stop after llvm-cbe generates new .cbe.c files",
    type: "boolean"
  },
  llvmOption: {
    optionName: "Co",
    description: "Add an option to llvm-opt",
    type: "string",
    isArray: true
  },
  llvmCbeOption: {
    optionName: "Cv",
    description: "Add an option to llvm-cbe",
    type: "string",
    isArray: true
  },
  zOpt: {
    optionName: "zopt",
    description: "Enable llvm-optimizer (clang only)",
    type: "boolean"
  },

  // --- Assembler options
  asmOption: {
    optionName: "Ca",
    description: "Add an option to the assembler",
    type: "string",
    isArray: true
  },
  z80Verbose: {
    optionName: "z80-verb",
    description: "Make the assembler more verbose",
    type: "boolean"
  },

  // --- Linker options
  linkerOption: {
    optionName: "Cl",
    description: "Add an option to the linker",
    type: "string",
    isArray: true
  },
  libSearchPath: {
    optionName: "L",
    description: "Add a library search path",
    type: "string",
    isArray: true
  },
  lib: {
    optionName: "l",
    description: "Add a library",
    type: "string",
    isArray: true
  },
  linkerOutput: {
    optionName: "bn",
    description: "Set the output file for the linker stage",
    type: "string"
  },
  relocInfo: {
    optionName: "reloc-info",
    description: "Generate binary file relocation information",
    type: "boolean"
  },
  genMapFile: {
    optionName: "gen-map-file",
    description: "Generate an output map of the final executable",
    type: "boolean"
  },
  genSymFile: {
    optionName: "gen-sym-file",
    description: "Generate a symbol map of the final executable",
    type: "boolean"
  },
  list: {
    optionName: "-list",
    description: "Generate list files",
    type: "boolean"
  },

  // --- Appmake options
  appMakeOption: {
    optionName: "Cz",
    description: "Add an option to appmake",
    type: "string",
    isArray: true
  },

  // --- Misc options
  globalDefC: {
    optionName: "g",
    description:
      "Generate a global defc file of the final executable (-g -gp -gpf:filename)",
    type: "string"
  },
  alias: {
    description: "Define a command line alias",
    type: "string",
    isArray: true
  },
  listCwd: {
    optionName: "-lstcwd",
    description: "Paths in .lst files are relative to the current working dir",
    type: "boolean"
  },
  customCoptRules: {
    optionName: "custom-copt-rules",
    description: "Custom user copt rules",
    type: "string"
  },
  swallowM: {
    optionName: "M",
    description: "Swallow -M option in configs",
    type: "boolean"
  },
  cmdTracingOff: {
    optionName: "vn",
    description: "Turn off command tracing",
    type: "boolean"
  },
  noCleanup: {
    optionName: "no-cleanup",
    description: "Do not cleanup temporary files",
    type: "boolean"
  }
};

function cloneZccOptions (): CmdLineOptionSet {
  const result: CmdLineOptionSet = {};
  for (const key in ZccOptions) {
    result[key] = { ...ZccOptions[key] };
  }
  return result;
}

/**
 * ZCC wrapper to invoke the ZCC process
 */
class ZccImplementation {
  readonly _target: string;
  readonly _optionTemplate = cloneZccOptions();
  readonly _options: Record<string, any> = {};
  readonly _files: string[] = [];

  /**
   * Prefix used with options
   */
  get optionPrefix (): string {
    return "-";
  }

  /**
   * Creates a new ZCC instance
   * @param target Target CPU
   * @param options Compiler options
   * @param files Files to compile
   */
  constructor (
    target: string = "zx",
    options: Record<string, any> = {},
    files: string[] = []
  ) {
    this._target = target;
    this._options = options;
    this._files = files;
  }

  /**
   * Adds a file to the compilation list
   * @param file File to add to the compilation list
   */
  addFile (file: string): void {
    this._files.push(file);
  }

  /**
   * Executes the ZCC process
   */
  execute (): void {
    // TODO: Implement this
  }

  composeCmdLineArgs (): OptionResult | string {
    const optionValues = this.composeOptionValues();
    if (optionValues.errors && Object.keys(optionValues.errors).length > 0) {
      return optionValues;
    }
    return `+${this._target} ${optionValues.cmdLine} ${this._files.join(" ")}`;
  }

  /**
   * Composes the option values
   * @returns Result of option composition
   */
  composeOptionValues (): OptionResult {
    const result: OptionResult = {
      cmdLine: "",
      errors: {}
    };
    const optionsFound = new Set<string>();
    for (const key in this._options) {
      const opt = this._optionTemplate[key];
      if (!opt) {
        error(key, `Unknown option: ${key}`);
        continue;
      }

      // --- Check the value
      let value = this._options[key];
      let errorFound = false;

      if (opt.isArray) {
        // --- Test array options
        if (!Array.isArray(value)) {
          value = [value];
        }
        for (const item of value) {
          if (opt.type === "string" && typeof item !== "string") {
            error(key, `Option ${key} must be an array of strings`);
            errorFound = true;
          }
          if (opt.type === "number" && typeof item !== "number") {
            error(key, `Option ${key} must be an array of numbers`);
            errorFound = true;
          }
        }
      } else {
        if (optionsFound.has(key)) {
          error(key, `Option ${key} can be specified only once`);
          continue;
        }
        // --- Check the type of the option
        if (opt.type === "string" && typeof value !== "string") {
          error(key, `Option ${key} must be a string`);
          continue;
        }
        if (opt.type === "number" && typeof value !== "number") {
          error(key, `Option ${key} must be a number`);
          continue;
        }
        if (opt.type === "boolean" && typeof value !== "boolean") {
          error(key, `Option ${key} must be a boolean`);
          continue;
        }
      }

      if (errorFound) {
        continue;
      }

      // --- Render the option
      if (Array.isArray(value)) {
        for (const item of value) {
          const optStr = this.renderCmdOption(key, item, opt);
          if (optStr) {
            if (result.cmdLine) {
              result.cmdLine += " ";
            }
            result.cmdLine += optStr;
          }
        }
      } else {
        const optStr = this.renderCmdOption(key, value, opt);
        if (optStr) {
          if (result.cmdLine) {
            result.cmdLine += " ";
          }
          result.cmdLine += optStr;
        }
      }

      // --- Mark the option as found
      optionsFound.add(key);
    }

    // --- Done
    return result;

    // --- Report an option error
    function error (key: string, message: string): void {
      const existing = result.errors[key];
      if (existing) {
        existing.push(message);
      } else {
        result.errors[key] = [message];
      }
    }
  }

  // --- Renders a single option
  renderCmdOption (
    key: string,
    value: any,
    optionDesc: CmdLineOptionDescriptor
  ): string {
    // --- Render the option
    const optionName = `${this.optionPrefix}${optionDesc.optionName || key}`;
    switch (optionDesc.type) {
      case "boolean":
        return value ? optionName : "";
      case "string":
        return value
          ? `${optionName}=${/\s/.test(value) ? `"${value}"` : value}`
          : "";
      case "number":
        return `${optionName}=${value}`;
    }
  }
}

// --- The result of option composition
type OptionResult = {
  cmdLine: string;
  errors: Record<string, string[]>;
};

export const createZcc = (
  target: string = "zx",
  options: Record<string, any> = {},
  files: string[] = []
) => new ZccImplementation(target, options, files);
