import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CodeToInject } from "@abstractions/CodeToInject";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { IdeCommandBase, commandError, commandSuccessWith } from "../services/ide-commands";
import {
  incInjectionVersionAction,
  setProjectDebuggingAction
} from "@common/state/actions";
import { isInjectableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";
import {
  compileCode,
  modelTypeToMachineType
} from "@renderer/appIde/utils/compile-code";

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
    context.store.dispatch(setProjectDebuggingAction(false), "ide");
    return await injectCode(context, "run");
  }
}

export class DebugCodeCommand extends IdeCommandBase {
  readonly id = "debug";
  readonly description = "Runs the current project's code in the virtual machine with debugging";
  readonly usage = "debug";
  readonly aliases = ["rd"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.store.dispatch(setProjectDebuggingAction(true), "ide");
    return await injectCode(context, "debug");
  }
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
      const shortReturnMessage = "Compilation failed with errors.";
      await context.service.ideCommandsService.executeCommand("outp build");
      return commandError(shortReturnMessage);
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
      await context.emuApi.injectCodeCommand(codeToInject);
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
      await context.emuApi.runCodeCommand(codeToInject, null, false, false);
      returnMessage = `Code injected and started.`;
      break;
    }

    case "debug": {
      // --- Check if we have debug information
      if (result.sourceFileList.length === 0) {
        const out = context.output;
        out.color("yellow");
        out.writeLine("No debug information available.");
        out.resetStyle();
        await context.emuApi.runCodeCommand(codeToInject, null, false, false);
        returnMessage = `$W:Code injected and started without debugging.`;
        break;
      }
      await context.emuApi.runCodeCommand(codeToInject, null, true, true);
      returnMessage = `Code injected and started in debug mode.`;
      break;
    }
  }

  // --- Injection done
  dispatch(incInjectionVersionAction());
  return commandSuccessWith(returnMessage);
}
