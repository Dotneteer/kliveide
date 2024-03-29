import { MachineControllerState } from "@abstractions/MachineControllerState";
import { createMachineCommand, MachineCommand } from "@messaging/main-to-emu";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  commandError,
  toHexa4
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class StartMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-start";
  readonly description = "Starts the emulated machine";
  readonly usage = "em-start";
  readonly aliases = [":s"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      const response = await context.messenger.sendMessage(
        createMachineCommand("start")
      );
      if (response.type === "ErrorResponse") {
        return commandError(`Starting machine failed: ${response.message}`);
      }
      writeSuccessMessage(context.output, "Machine started");
      return commandSuccess;
    }
    return commandError(
      "The machine must be turned off, stopped, or paused to start"
    );
  }
}

export class PauseMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-pause";
  readonly description = "Pauses the started machine";
  readonly usage = "em-pause";
  readonly aliases = [":p"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Running) {
      const cpuState = await context.messenger.sendMessage({
        type: "EmuGetCpuState"
      });
      if (cpuState.type === "ErrorResponse") {
        return commandError(`EmuGetCpuState call failed: ${cpuState.message}`);
      }
      if (cpuState.type !== "EmuGetCpuStateResponse") {
        return commandError(`Unexpected response type: ${cpuState.type}`);
      }

      const response = await context.messenger.sendMessage(
        createMachineCommand("pause")
      );
      if (response.type === "ErrorResponse") {
        return commandError(`Pausing machine failed: ${response.message}`);
      }
      writeSuccessMessage(
        context.output,
        `Machine paused at PC=$${toHexa4(cpuState.pc)}`
      );
      return commandSuccess;
    }
    return commandError("The machine must be running to pause it");
  }
}

export class StopMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-stop";
  readonly description = "Stops the started machine";
  readonly usage = "em-stop";
  readonly aliases = [":h"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      const cpuState = await context.messenger.sendMessage({
        type: "EmuGetCpuState"
      });
      if (cpuState.type === "ErrorResponse") {
        return commandError(`EmuGetCpuState call failed: ${cpuState.message}`);
      }
      if (cpuState.type !== "EmuGetCpuStateResponse") {
        return commandError(`Unexpected response type: ${cpuState.type}`);
      }

      const response = await context.messenger.sendMessage(
        createMachineCommand("stop")
      );
      if (response.type === "ErrorResponse") {
        return commandError(`Stopping machine failed: ${response.message}`);
      }
      writeSuccessMessage(
        context.output,
        `Machine stopped at PC=$${toHexa4(cpuState.pc)}`
      );
      return commandSuccess;
    }
    return commandError("Machine must be running or paused to stop it");
  }
}

export class RestartMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-restart";
  readonly description = "Restarts the started machine";
  readonly usage = "em-restart";
  readonly aliases = [":r"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      const response = await context.messenger.sendMessage(
        createMachineCommand("restart")
      );
      if (response.type === "ErrorResponse") {
        return commandError(`Restarting machine failed: ${response.message}`);
      }
      writeSuccessMessage(context.output, "Machine restarted");
      return commandSuccess;
    }
    return commandError("Machine must be running or paused to restart it");
  }
}

export class StartDebugMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-debug";
  readonly description = "Starts the emulated machine in debug mode";
  readonly usage = "em-debug";
  readonly aliases = [":d"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      const response = await context.messenger.sendMessage(
        createMachineCommand("debug")
      );
      writeSuccessMessage(context.output, "Machine started in debug mode");
      if (response.type === "ErrorResponse") {
        return commandError(`Starting machine failed: ${response.message}`);
      }
      return commandSuccess;
    }
    return commandError(
      "The machine must be turned off, stopped, or paused to start"
    );
  }
}

export class StepIntoMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-sti";
  readonly description = "Step-into the next machine instruction";
  readonly usage = "em-sti";
  readonly aliases = [":"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepInto", "Step into");
  }
}

export class StepOverMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-sto";
  readonly description = "Step-over the next machine instruction";
  readonly usage = "em-sto";
  readonly aliases = ["."];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepOver", "Step over");
  }
}

export class StepOutMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-out";
  readonly description = "Step-out from the current machine subroutine";
  readonly usage = "em-out";
  readonly aliases = [":o"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
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
    const cpuState = await context.messenger.sendMessage({
      type: "EmuGetCpuState"
    });
    if (cpuState.type === "ErrorResponse") {
      return commandError(`EmuGetCpuState call failed: ${cpuState.message}`);
    }
    if (cpuState.type !== "EmuGetCpuStateResponse") {
      return commandError(`Unexpected response type: ${cpuState.type}`);
    }

    const response = await context.messenger.sendMessage(
      createMachineCommand(cmd)
    );
    if (response.type === "ErrorResponse") {
      return commandError(`Starting machine failed: ${response.message}`);
    }
    writeSuccessMessage(
      context.output,
      `${cmdName} at PC=$${toHexa4(cpuState.pc)}`
    );
    return commandSuccess;
  }
  return commandError("The machine must be paused");
}
