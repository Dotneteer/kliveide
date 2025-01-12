import type { MachineCommand } from "@messaging/main-to-emu";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  writeSuccessMessage,
  commandSuccess,
  commandError,
  toHexa4,
  IdeCommandBase
} from "../services/ide-commands";

export class StartMachineCommand extends IdeCommandBase {
  readonly id = "em-start";
  readonly description = "Starts the emulated machine";
  readonly usage = "em-start";
  readonly aliases = [":s"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      await context.emuApiAlt.issueMachineCommand("start");
      writeSuccessMessage(context.output, "Machine started");
      return commandSuccess;
    }
    return commandError(
      "The machine must be turned off, stopped, or paused to start"
    );
  }
}

export class PauseMachineCommand extends IdeCommandBase {
  readonly id = "em-pause";
  readonly description = "Pauses the started machine";
  readonly usage = "em-pause";
  readonly aliases = [":p"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Running) {
      const cpuState = await context.emuApiAlt.getCpuState();
      await context.emuApiAlt.issueMachineCommand("pause");
      writeSuccessMessage(
        context.output,
        `Machine paused at PC=$${toHexa4(cpuState.pc)}`
      );
      return commandSuccess;
    }
    return commandError("The machine must be running to pause it");
  }
}

export class StopMachineCommand extends IdeCommandBase {
  readonly id = "em-stop";
  readonly description = "Stops the started machine";
  readonly usage = "em-stop";
  readonly aliases = [":h"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      const cpuState = await context.emuApiAlt.getCpuState();
      await context.emuApiAlt.issueMachineCommand("stop");
      writeSuccessMessage(
        context.output,
        `Machine stopped at PC=$${toHexa4(cpuState.pc)}`
      );
      return commandSuccess;
    }
    return commandError("Machine must be running or paused to stop it");
  }
}

export class RestartMachineCommand extends IdeCommandBase {
  readonly id = "em-restart";
  readonly description = "Restarts the started machine";
  readonly usage = "em-restart";
  readonly aliases = [":r"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      await context.emuApiAlt.issueMachineCommand("restart");
      writeSuccessMessage(context.output, "Machine restarted");
      return commandSuccess;
    }
    return commandError("Machine must be running or paused to restart it");
  }
}

export class StartDebugMachineCommand extends IdeCommandBase {
  readonly id = "em-debug";
  readonly description = "Starts the emulated machine in debug mode";
  readonly usage = "em-debug";
  readonly aliases = [":d"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      await context.emuApiAlt.issueMachineCommand("debug");
      writeSuccessMessage(context.output, "Machine started in debug mode");
      return commandSuccess;
    }
    return commandError(
      "The machine must be turned off, stopped, or paused to start"
    );
  }
}

export class StepIntoMachineCommand extends IdeCommandBase {
  readonly id = "em-sti";
  readonly description = "Step-into the next machine instruction";
  readonly usage = "em-sti";
  readonly aliases = [":"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepInto", "Step into");
  }
}

export class StepOverMachineCommand extends IdeCommandBase {
  readonly id = "em-sto";
  readonly description = "Step-over the next machine instruction";
  readonly usage = "em-sto";
  readonly aliases = ["."];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepOver", "Step over");
  }
}

export class StepOutMachineCommand extends IdeCommandBase {
  readonly id = "em-out";
  readonly description = "Step-out from the current machine subroutine";
  readonly usage = "em-out";
  readonly aliases = [":o"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepOut", "Step out");
  }
}

async function stepCommand (
  context: IdeCommandContext,
  cmd: MachineCommand,
  cmdName: string
): Promise<IdeCommandResult> {
  const machineState = context.store.getState()?.emulatorState?.machineState;
  if (machineState === MachineControllerState.Paused) {
    const cpuState = await context.emuApiAlt.getCpuState();
    await context.emuApiAlt.issueMachineCommand(cmd);
    writeSuccessMessage(
      context.output,
      `${cmdName} at PC=$${toHexa4(cpuState.pc)}`
    );
    return commandSuccess;
  }
  return commandError("The machine must be paused");
}
