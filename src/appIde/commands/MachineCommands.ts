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
      "The machine must be turned off, stopped, or paused to start"
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
      writeMessage(context.output, "Machine paused", "green");
      return commandSuccess;
    }
    return commandError(
      "The machine must be running to pause it"
    );
  }
}

export class StopMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-stop";
  readonly description = "Stops the started machine";
  readonly usage = "em-stop";
  readonly aliases = [":h"];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused) {
      await context.messenger.sendMessage(createMachineCommand("stop"));
      writeMessage(context.output, "Machine stopped", "green");
      return commandSuccess;
    }
    return commandError(
      "Machine must be running or paused to stop it"
    );
  }
}

export class RestartMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-restart";
  readonly description = "Restarts the started machine";
  readonly usage = "em-restart";
  readonly aliases = [":r"];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused) {
      await context.messenger.sendMessage(createMachineCommand("restart"));
      writeMessage(context.output, "Machine restarted", "green");
      return commandSuccess;
    }
    return commandError(
      "Machine must be running or paused to restart it"
    );
  }
}

export class StartDebugMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-debug";
  readonly description = "Starts the emulated machine in debug mode";
  readonly usage = "em-debug";
  readonly aliases = [":d"];

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
      writeMessage(context.output, "Machine started in debug mode", "green");
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

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Paused) {
      await context.messenger.sendMessage(createMachineCommand("stepInto"));
      writeMessage(context.output, "Executing ...", "cyan");
      return commandSuccess;
    }
    return commandError(
      "The machine must be paused"
    );
  }
}

export class StepOverMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-sto";
  readonly description = "Step-over the next machine instruction";
  readonly usage = "em-sto";
  readonly aliases = ["."];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Paused) {
      await context.messenger.sendMessage(createMachineCommand("stepOver"));
      writeMessage(context.output, "Executing ...", "cyan");
      return commandSuccess;
    }
    return commandError(
      "The machine must be paused"
    );
  }
}

export class StepOutMachineCommand extends CommandWithNoArgBase {
  readonly id = "em-out";
  readonly description = "Step-out from the current machine subroutine";
  readonly usage = "em-out";
  readonly aliases = [":o"];

  async execute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const machineState = context.store.getState()?.emulatorState?.machineState;
    if (machineState === MachineControllerState.Paused) {
      await context.messenger.sendMessage(createMachineCommand("stepOut"));
      writeMessage(context.output, "Executing ...", "cyan");
      return commandSuccess;
    }
    return commandError(
      "The machine must be paused"
    );
  }
}
