import { createMachineCommand } from "@messaging/main-to-emu";
import { MachineControllerState } from "@state/MachineControllerState";
import {
  InteractiveCommandContext,
  InteractiveCommandResult
} from "../abstractions";
import {
  commandError,
  commandSuccess,
  writeMessage
} from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class StartMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-start";
  readonly description = "Starts the emulated machine";
  readonly usage = "em-start";
  readonly aliases = [":s"];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      await context.messenger.sendMessage(createMachineCommand("start"));
      writeMessage(context.output, "Machine started", "green");
      return commandSuccess;
    }
    return commandError(
      "Machine must be turned off, stopped, or paused to start"
    );
  }
}

export class PauseMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-pause";
  readonly description = "Pauses the started machine";
  readonly usage = "em-pause";
  readonly aliases = [":p"];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Running) {
      await context.messenger.sendMessage(createMachineCommand("pause"));
      writeMessage(context.output, "Machine paused", "cyan");
      return commandSuccess;
    }
    return commandError(
      "Machine must be running to be paused"
    );
  }
}
