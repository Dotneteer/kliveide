import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";
import type { CodeToInject } from "@abstractions/CodeToInject";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { IdeCommandBase, commandError, commandSuccessWith } from "../services/ide-commands";
import { isInjectableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { SpectrumModelType } from "@abstractions/CompilerInfo";
import {
  endCompileAction,
  incBreakpointsVersionAction,
  incInjectionVersionAction,
  startCompileAction
} from "@common/state/actions";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { outputNavigateAction } from "@common/utils/output-utils";

type CodeInjectionType = "inject" | "run" | "debug";

export class CompileCommand extends IdeCommandBase {
  readonly id = "compile";
  readonly description = "Compiles the current project";
  readonly usage = "compile";
  readonly aliases = ["co"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    return compileResult.message
      ? commandError(compileResult.message)
      : commandSuccessWith(`Project file successfully compiled.`);
  }
}

export class InjectCodeCommand extends IdeCommandBase {
  readonly id = "inject";
  readonly description = "Injects the current projec code into the machine";
  readonly usage = "inject";
  readonly aliases = ["inj"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "inject");
  }
}

export class RunCodeCommand extends IdeCommandBase {
  readonly id = "run";
  readonly description = "Runs the current project's code in the virtual machine";
  readonly usage = "run";
  readonly aliases = ["r"];
  readonly requiresProject = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "run");
  }
}

export class DebugCodeCommand extends IdeCommandBase {
  readonly id = "debug";
  readonly description = "Runs the current project's code in the virtual machine with debugging";
  readonly usage = "debug";
  readonly aliases = ["rd"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "debug");
  }
}

// --- Gets the model code according to machine type
function modelTypeToMachineType(model: SpectrumModelType): string | null {
  switch (model) {
    case SpectrumModelType.Spectrum48:
      return "sp48";
    case SpectrumModelType.Spectrum128:
      return "sp128";
    case SpectrumModelType.SpectrumP3:
      return "spp3e";
    case SpectrumModelType.Next:
      return "next";
    default:
      return null;
  }
}

// --- Compile the current project's code
async function compileCode(
  context: IdeCommandContext
): Promise<{ result?: KliveCompilerOutput; message?: string }> {
  // --- Shortcuts
  const out = context.output;

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
  const language = getFileTypeEntry(fullPath, context.store)?.subType;

  // --- Compile the build root
  out.color("bright-blue");
  out.write("Start compiling ");
  outputNavigateAction(context.output, buildRoot);
  out.writeLine();
  out.resetStyle();

  context.store.dispatch(startCompileAction(fullPath));
  let result: KliveCompilerOutput;
  let failedMessage = "";
  try {
    result = await context.mainApi.compileFile(fullPath, language);
  } catch (err) {
    failedMessage = err.message;
  }
  finally {
    context.store.dispatch(endCompileAction(result));
    await refreshSourceCodeBreakpoints(context.store, context.messenger);
    context.store.dispatch(incBreakpointsVersionAction());
  }

  // --- Display optional trace output
  const traceOutput = result?.traceOutput;
  if (traceOutput?.length > 0) {
    out.resetStyle();
    traceOutput.forEach((msg) => out.writeLine(msg));
  }

  // --- Collect errors
  const errorCount = result?.errors.filter((m) => !m.isWarning).length ?? 0;

  if (failedMessage) {
    if (!result || errorCount === 0) {
      // --- Some unexpected error with the compilation
      return { message: failedMessage };
    }
  }

  // --- Display the errors
  if ((result.errors?.length ?? 0) > 0) {
    for (let i = 0; i < result.errors.length; i++) {
      const err = result.errors[i];
      out.color(err.isWarning ? "yellow" : "bright-red");
      out.bold(true);
      out.write(`${err.errorCode}: ${err.message}`);
      out.write(" - ");
      out.bold(false);
      out.color("bright-cyan");
      outputNavigateAction(context.output, err.filename, err.line, err.startColumn);
      out.writeLine();
      out.resetStyle();
    }
  }

  // --- Done.
  return errorCount > 0
    ? {
        result,
        message: `Compilation failed with ${errorCount} error${errorCount > 1 ? "s" : ""}.`
      }
    : { result };
}

async function injectCode(
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
      const returnMessage = "Code compilation failed, no program to inject.";
      await context.mainApi.displayMessageBox("error", "Injecting code", returnMessage);
      return commandError(returnMessage);
    }
  }

  if (!isInjectableCompilerOutput(result)) {
    return commandError("Compiled code is not injectable.");
  }

  let sumCodeLength = 0;
  result.segments.forEach((s) => (sumCodeLength += s.emittedCode.length));
  if (sumCodeLength === 0) {
    await context.mainApi.displayMessageBox(
      "info",
      "Injecting code",

      "The length of the compiled code is 0, " +
        "so there is no code to inject into the virtual machine."
    );
    return commandSuccessWith("Code length is 0, no code injected");
  }

  if (operationType === "inject") {
    if (context.store.getState().emulatorState?.machineState !== MachineControllerState.Paused) {
      await context.mainApi.displayMessageBox(
        "warning",
        "Injecting code",
        "To inject the code into the virtual machine, please put it in paused state."
      );
      return commandError("Machine must be in paused state.");
    }
  }

  // --- Create the code to inject into the emulator
  const codeToInject: CodeToInject = {
    model: modelTypeToMachineType(result.modelType),
    entryAddress: result.entryAddress,
    subroutine: result.injectOptions["subroutine"],
    segments: result.segments.map((s) => ({
      startAddress: s.startAddress,
      bank: s.bank,
      bankOffset: s.bankOffset ?? 0,
      emittedCode: s.emittedCode
    })),
    options: result.injectOptions
  };

  const dispatch = context.store.dispatch;
  let returnMessage = "";

  switch (operationType) {
    case "inject":
      await context.emuApiAlt.injectCodeCommand(codeToInject);
      returnMessage = `Successfully injected ${sumCodeLength} bytes in ${
        codeToInject.segments.length
      } segment${
        codeToInject.segments.length > 1 ? "s" : ""
      } from start address $${codeToInject.segments[0].startAddress
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()}`;
      await context.mainApi.displayMessageBox("info", "Injecting code", returnMessage);
      break;

    case "run": {
      await context.emuApiAlt.runCodeCommand(codeToInject, false);
      returnMessage = `Code injected and started.`;
      break;
    }

    case "debug": {
      await context.emuApiAlt.runCodeCommand(codeToInject, true);
      returnMessage = `Code injected and started in debug mode.`;
      break;
    }
  }

  // --- Injection done
  dispatch(incInjectionVersionAction());
  return commandSuccessWith(returnMessage);
}
