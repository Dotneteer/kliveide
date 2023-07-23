import { MainCompileResponse } from "@common/messaging/any-to-main";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { getFileTypeEntry } from "../project/project-node";
import { commandError, commandSuccessWith } from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import {
  KliveCompilerOutput,
  isInjectableCompilerOutput
} from "../../../electron/compiler-integration/compiler-registry";
import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { CodeInjectionType, CodeToInject } from "../abstractions/code-related";
import { SpectrumModelType } from "@common/abstractions/IZ80CompilerService";

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
  readonly description = "Runs the current project's code in the virtual machine";
  readonly usage = "run";
  readonly aliases = ["r"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "run");
  }
}

export class DebugCodeCommand extends CommandWithNoArgBase {
  readonly id = "debug";
  readonly description = "Runs the current project's code in the virtual machine with debugging";
  readonly usage = "debug";
  readonly aliases = ["rd"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "debug");
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
