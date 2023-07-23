import {
  MainCompileResponse,
  TextContentsResponse
} from "@common/messaging/any-to-main";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { getFileTypeEntry } from "../project/project-node";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  commandSuccessWith,
  getNumericTokenValue,
  toHexa2,
  toHexa4,
  validationError,
  writeSuccessMessage
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import {
  InjectableOutput,
  KliveCompilerOutput,
  isInjectableCompilerOutput
} from "../../../electron/compiler-integration/compiler-registry";
import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { CodeInjectionType, CodeToInject } from "../abstractions/code-related";
import {
  BinarySegment,
  SpectrumModelType
} from "@common/abstractions/IZ80CompilerService";
import { incDocumentActivationVersionAction } from "@common/state/actions";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token, TokenType } from "../services/command-parser";

export class CompileCommand extends CommandWithNoArgBase {
  readonly id = "compile";
  readonly description = "Compiles the current project";
  readonly usage = "compile";
  readonly aliases = ["co"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    return compileResult.message
      ? commandError(compileResult.message)
      : commandSuccessWith(`Project file successfully compiled.`);
  }
}

export class InjectCodeCommand extends CommandWithNoArgBase {
  readonly id = "inject";
  readonly description = "Injects the current projec code into the machine";
  readonly usage = "inject";
  readonly aliases = ["inj"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "inject");
  }
}

export class RunCodeCommand extends CommandWithNoArgBase {
  readonly id = "run";
  readonly description =
    "Runs the current project's code in the virtual machine";
  readonly usage = "run";
  readonly aliases = ["r"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "run");
  }
}

export class DebugCodeCommand extends CommandWithNoArgBase {
  readonly id = "debug";
  readonly description =
    "Runs the current project's code in the virtual machine with debugging";
  readonly usage = "debug";
  readonly aliases = ["rd"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "debug");
  }
}

export class ExportCodeCommand extends IdeCommandBase {
  readonly id = "expc";
  readonly description = "Export the code of the current project";
  readonly usage =
    "expc name filename [format] [-as] [-c] [-b border] [-sb] [-addr address] [-scr screenfile]";

  private name?: string;
  private filename?: string;
  private format = "tzx";
  private autoStart = false;
  private applyClear = false;
  private border?: number;
  private singleBlock = false;
  private address?: number;
  private screenFile?: string;

  prepareCommand (): void {
    this.format = "tzx";
    this.autoStart = false;
    this.applyClear = false;
    this.singleBlock = false;
    this.border = this.address = this.screenFile = undefined;
  }

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (args.length < 2) {
      return validationError("This command expects at least 2 arguments");
    }
    this.name = args[0].text;
    this.filename = args[1].text;
    let argPos = 2;
    if (args.length >= 3) {
      if (args[2].type === TokenType.Identifier) {
        const format = args[2].text;
        if (format !== "tzx" && format !== "tap" && format !== "hex") {
          return validationError(
            "Only 'tzx', 'tap', or 'hex' formats are accepted."
          );
        }
        this.format = format;
        argPos = 3;
      }
    }

    // --- Obtain additional arguments
    let cFound = false;
    let sbFound = false;
    while (argPos < args.length) {
      switch (args[argPos].text) {
        case "-as":
          this.autoStart = true;
          break;
        case "-c":
          this.applyClear = true;
          break;
        case "-b": {
          argPos++;
          if (args[argPos] === undefined) {
            return validationError("Missing value for '-b'");
          }
          const { value } = getNumericTokenValue(args[argPos]);
          if (value === null) {
            return validationError("Numeric value expected for '-b'");
          }
          this.border = value & 0x07;
          break;
        }
        case "-sb":
          this.singleBlock = true;
          break;
        case "-addr": {
          argPos++;
          if (args[argPos] === undefined) {
            return validationError("Missing value for '-addr'");
          }
          const { value } = getNumericTokenValue(args[argPos]);
          if (value === null) {
            return validationError("Numeric value expected for '-addr'");
          }
          this.border = value & 0xffff;
          break;
        }
        case "-scr": {
          argPos++;
          if (args[argPos] === undefined) {
            return validationError("Missing value for '-scr'");
          }
          this.screenFile = args[argPos].text;
          break;
        }
        default:
          return validationError(`Unexpected argument: '${args[argPos].text}'`);
      }
      argPos++;
    }
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Compile before export
    const { message, result } = await compileCode(context);
    const errorNo = result?.errors?.length ?? 0;
    if (message) {
      if (!result) {
        return commandError(message);
      }
      if (errorNo > 0) {
        const message = "Code compilation failed, no program to export.";
        await context.messenger.sendMessage({
          type: "MainDisplayMessageBox",
          messageType: "error",
          title: "Exporting code",
          message
        });
        return commandError(message);
      }
    }

    if (!isInjectableCompilerOutput(result)) {
      return commandError("Compiled code is not injectable.");
    }

    return this.exportCompiledCode(context, result);
  }

  async exportCompiledCode (
    context: IdeCommandContext,
    output: KliveCompilerOutput
  ): Promise<IdeCommandResult> {
    if (this.format == "hex") {
      return await this.saveIntelHexFile(context, this.filename, output);
    }

    // // --- Check for screen file error
    // var useScreenFile = !string.IsNullOrEmpty(vm.ScreenFile) && vm.ScreenFile.Trim().Length > 0;
    // if (useScreenFile && !CommonTapeFilePlayer.CheckScreenFile(vm.ScreenFile))
    // {
    //     return 1;
    // }

    // // --- Step #6: Create code segments
    // var codeBlocks = CreateTapeBlocks(output, vm.Name, vm.SingleBlock);
    // List<byte[]> screenBlocks = null;
    // if (useScreenFile)
    // {
    //     screenBlocks = CreateScreenBlocks(vm.ScreenFile);
    // }

    // // --- Step #7: Create Auto Start header block, if required
    // var blocksToSave = new List<byte[]>();
    // if (!ushort.TryParse(vm.StartAddress, out var startAddress))
    // {
    //     startAddress = (ushort)(output == null
    //         ? -1
    //         : output.ExportEntryAddress
    //             ?? output.EntryAddress
    //             ?? output.Segments[0].StartAddress);
    // }

    // if (vm.AutoStartEnabled)
    // {
    //     var autoStartBlocks = CreateAutoStartBlock(
    //         output,
    //         vm.Name,
    //         vm.SingleBlock,
    //         useScreenFile,
    //         vm.AddPause0,
    //         vm.Border,
    //         startAddress,
    //         vm.ApplyClear
    //             ? output.Segments.Min(s => s.StartAddress)
    //             : (ushort?)null);
    //     blocksToSave.AddRange(autoStartBlocks);
    // }

    // // --- Step #8: Save all the blocks
    // if (screenBlocks != null)
    // {
    //     blocksToSave.AddRange(screenBlocks);
    // }

    // blocksToSave.AddRange(codeBlocks);
    // SaveDataBlocks(vm, blocksToSave);
    // return 0;
  }

  async saveIntelHexFile (
    context: IdeCommandContext,
    filename: string,
    output: KliveCompilerOutput
  ): Promise<IdeCommandResult> {
    const rowLen = 0x10;
    let hexOut = "";

    for (const segment of (output as InjectableOutput).segments) {
      var offset = 0;
      while (offset + rowLen < segment.emittedCode.length) {
        // --- Write an entire data row
        writeDataRecord(segment, offset, rowLen);
        offset += rowLen;
      }

      // --- Write the left of the data row
      var leftBytes = segment.emittedCode.length - offset;
      writeDataRecord(segment, offset, leftBytes);
    }

    // --- Write End-Of-File record
    hexOut += ":00000001FF";

    // --- Save the data to a file
    if (filename) {
      const response = await context.messenger.sendMessage({
        type: "MainSaveTextFile",
        path: filename,
        data: hexOut
      });
      if (response.type === "ErrorResponse") {
        return commandError(response.message);
      }
    }
    return commandSuccessWith("Intel HEX file successfully exported.");

    // --- Write out a single data record
    function writeDataRecord (
      segment: BinarySegment,
      offset: number,
      bytesCount: number
    ): void {
      if (bytesCount === 0) return;
      var addr =
        ((segment.xorgValue ?? segment.startAddress) + offset) & 0xffff;
      hexOut += `:${toHexa2(bytesCount)}${toHexa4(addr)}00`; // --- Data record header
      let checksum = bytesCount + (addr >> 8) + (addr & 0xff);
      for (var i = offset; i < offset + bytesCount; i++) {
        var data = segment.emittedCode[i];
        checksum += data;
        hexOut += `${toHexa2(data)}`;
      }
      const chk = (256 - (checksum & 0xff)) & 0xff;
      hexOut += `${toHexa2(chk)}\r\n`;
    }
  }
}

// --- Gets the model code according to machine type
function modelTypeToMachineType (model: SpectrumModelType): string {
  switch (model) {
    case SpectrumModelType.Spectrum48:
      return "48";
    case SpectrumModelType.Spectrum128:
      return "128";
    case SpectrumModelType.SpectrumP3:
      return "p3";
    case SpectrumModelType.Next:
      return "next";
    default:
      return "";
  }
}

// --- Compile the current project's code
async function compileCode (
  context: IdeCommandContext
): Promise<{ result?: KliveCompilerOutput; message?: string }> {
  // --- Shortcuts
  const out = context.output;
  const ideCmd = context.service.ideCommandsService;

  // --- Check if we have a build root to compile
  const state = context.store.getState();
  if (!state.project?.isKliveProject) {
    return { message: "No Klive project loaded." };
  }
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot) {
    return { message: "No build root selected in the current Klive project." };
  }
  const fullPath = `${state.project.folderPath}/${buildRoot}`;
  const language = getFileTypeEntry(fullPath)?.subType;

  // --- Compile the build root
  out.color("bright-blue");
  out.write("Start compiling ");
  ideCmd.writeNavigationAction(context, buildRoot);
  out.writeLine();
  out.resetStyle();

  const response = await context.messenger.sendMessage<MainCompileResponse>({
    type: "MainCompileFile",
    filename: fullPath,
    language
  });

  // --- Collect errors
  const result = response.result;
  const errors = result?.errors;

  if (response.failed) {
    if (!result || (errors?.length ?? 0) === 0) {
      // --- Some unexpected error with the compilation
      return { message: response.failed };
    }
  }

  // --- Display the errors
  if ((errors?.length ?? 0) > 0) {
    for (let i = 0; i < response.result.errors.length; i++) {
      const err = response.result.errors[i];
      out.color("bright-red");
      out.bold(true);
      out.write(`Error ${err.errorCode}: ${err.message}`);
      out.write(" - ");
      out.bold(false);
      out.color("bright-cyan");
      ideCmd.writeNavigationAction(
        context,
        err.fileName,
        err.line,
        err.startColumn
      );
      out.writeLine();
      out.resetStyle();
    }
    return {
      result,
      message: `Compilation failed with ${errors.length} error${
        errors.length > 1 ? "s" : ""
      }.`
    };
  }

  // --- Compilation ok.
  return { result };
}

async function injectCode (
  context: IdeCommandContext,
  operationType: CodeInjectionType
): Promise<IdeCommandResult> {
  const { message, result } = await compileCode(context);
  const errorNo = result?.errors?.length ?? 0;
  if (message) {
    if (!result) {
      return commandError(message);
    }
    if (errorNo > 0) {
      const message = "Code compilation failed, no program to inject.";
      await context.messenger.sendMessage({
        type: "MainDisplayMessageBox",
        messageType: "error",
        title: "Injecting code",
        message
      });
      return commandError(message);
    }
  }

  if (!isInjectableCompilerOutput(result)) {
    return commandError("Compiled code is not injectable.");
  }

  let sumCodeLength = 0;
  result.segments.forEach(s => (sumCodeLength += s.emittedCode.length));
  if (sumCodeLength === 0) {
    await context.messenger.sendMessage({
      type: "MainDisplayMessageBox",
      messageType: "info",
      title: "Injecting code",
      message:
        "The length of the compiled code is 0, " +
        "so there is no code to inject into the virtual machine."
    });
    return commandSuccessWith("Code length is 0, no code injected");
  }

  if (operationType === "inject") {
    if (
      context.store.getState().emulatorState?.machineState !==
      MachineControllerState.Paused
    ) {
      await context.messenger.sendMessage({
        type: "MainDisplayMessageBox",
        messageType: "warning",
        title: "Injecting code",
        message:
          "To inject the code into the virtual machine, please put it in paused state."
      });
      return commandError("Machine must be in paused state.");
    }
  }

  // --- Create the code to inject into the emulator
  const codeToInject: CodeToInject = {
    model: modelTypeToMachineType(result.modelType),
    entryAddress: result.entryAddress,
    subroutine: result.injectOptions["subroutine"],
    segments: result.segments.map(s => ({
      startAddress: s.startAddress,
      bank: s.bank,
      bankOffset: s.bankOffset ?? 0,
      emittedCode: s.emittedCode
    })),
    options: result.injectOptions
  };

  switch (operationType) {
    case "inject":
      await context.messenger.sendMessage({
        type: "EmuInjectCode",
        codeToInject
      });
      const message = `Successfully injected ${sumCodeLength} bytes in ${
        codeToInject.segments.length
      } segment${
        codeToInject.segments.length > 1 ? "s" : ""
      } from start address $${codeToInject.segments[0].startAddress
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()}`;
      await context.messenger.sendMessage({
        type: "MainDisplayMessageBox",
        messageType: "info",
        title: "Injecting code",
        message
      });
      return commandSuccessWith(message);

    case "run":
      await context.messenger.sendMessage({
        type: "EmuRunCode",
        codeToInject,
        debug: false
      });
      return commandSuccessWith(`Code injected and started.`);

    case "debug":
      await context.messenger.sendMessage({
        type: "EmuRunCode",
        codeToInject,
        debug: true
      });
      return commandSuccessWith(`Code injected and started in debug mode.`);
  }
}

const CLEAR_TKN = 0xfd;
const CODE_TKN = 0xaf;
const DATA_TKN = 0xe4;
const FOR_TKN = 0xeb;
const IF_TKN = 0xfa;
const GOTO_TKN = 0xec;
const LET_TKN = 0xf1;
const LOAD_TKN = 0xef;
const NEXT_TKN = 0xf3;
const PEEK_TKN = 0xbe;
const POKE_TKN = 0xf4;
const READ_TKN = 0xe3;
const REM_TKN = 0xea;
const THEN_TKN = 0xcb;
const TO_TKN = 0xcc;
const SCREEN_TKN = 0xaa;
const DQUOTE = 0x22;
const STOP_TKN = 0xe2;
const COLON = 0x3a;
const COMMA = 0x2c;
const RAND_TKN = 0xf9;
const USR_TKN = 0xc0;
const NUMB_SIGN = 0x0e;
const NEW_LINE = 0x0d;
const PAUSE_TKN = 0xf2;
const BORDER_TKN = 0xe7;
