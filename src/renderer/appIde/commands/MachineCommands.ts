import { SETTING_EMU_STEP_IN_INTERRUPTS, SETTING_EMU_STOP_ON_ERRORS } from "@common/settings/setting-const";
import type { MachineCommand } from "@abstractions/MachineCommand";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { SourceStepKind } from "@emu/machines/SourceStepDecision";
import { hasSourceLevelDebug } from "@renderer/appIde/utils/compiler-utils";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  writeSuccessMessage,
  commandSuccess,
  commandError,
  toHexa4,
  IdeCommandBase
} from "../services/ide-commands";

/**
 * Reads the machine's current state straight from the emulator.
 *
 * The copy in this window's store is only a mirror, kept up to date by state actions forwarded
 * from the emulator process. Those arrive asynchronously, so right after a state-changing command
 * (or two commands issued in quick succession from a keybinding or a script) the mirror can still
 * describe the previous state, and these preconditions are the only gate on the command - the
 * emulator itself performs no such check. Asking the emulator directly costs one round trip and
 * always reflects reality.
 */
async function getLiveMachineState(
  context: IdeCommandContext
): Promise<MachineControllerState | undefined> {
  try {
    return (await context.emuApi.getCpuStateChunk())?.state;
  } catch {
    // --- Fall back to the mirrored value if the emulator cannot be reached.
    return context.store.getState()?.emulatorState?.machineState;
  }
}

export class StartMachineCommand extends IdeCommandBase {
  readonly id = "em-start";
  readonly description = "Starts the emulated machine";
  readonly usage = "em-start";
  readonly aliases = [":s"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      await context.emuApi.issueMachineCommand("start");
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
    const machineState = await getLiveMachineState(context);
    if (machineState === MachineControllerState.Running) {
      const cpuState = await context.emuApi.getCpuState();
      await context.emuApi.issueMachineCommand("pause");
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
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      const cpuState = await context.emuApi.getCpuState();
      await context.emuApi.issueMachineCommand("stop");
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
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      await context.emuApi.issueMachineCommand("restart");
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
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.None ||
      machineState === MachineControllerState.Paused ||
      machineState === MachineControllerState.Stopped
    ) {
      await context.emuApi.issueMachineCommand("debug");
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
  const machineState = await getLiveMachineState(context);
  if (machineState === MachineControllerState.Paused) {
    const cpuState = await context.emuApi.getCpuState();
    await context.emuApi.issueMachineCommand(cmd);
    writeSuccessMessage(
      context.output,
      `${cmdName} at PC=$${toHexa4(cpuState.pc)}`
    );
    return commandSuccess;
  }
  return commandError("The machine must be paused");
}

// =================================================================================================
// Source-level stepping (plan §10.2.8): for a program with source-level debug info, such as one
// Klive BASIC built. Step Into/Over/Out step statements while Source stepping is on (`em-src`).

/** The paused machine's source-level step, or why it cannot run. */
async function sourceStepCommand(
  context: IdeCommandContext,
  kind: SourceStepKind,
  name: string,
  options: { targetFrame?: number; targetCallable?: number } = {}
): Promise<IdeCommandResult> {
  const machineState = await getLiveMachineState(context);
  if (machineState !== MachineControllerState.Paused) return commandError("The machine must be paused");
  if (!hasSourceLevelDebug(context.store.getState().compilation?.result)) {
    return commandError("The program has no source-level debug information (build it with Klive BASIC and debug)");
  }
  await context.emuApi.sourceStep(kind, options);
  writeSuccessMessage(context.output, name);
  return commandSuccess;
}

export class StepOverLineMachineCommand extends IdeCommandBase {
  readonly id = "em-stl";
  readonly description = "Step over the rest of the current source line (statements and the calls they make)";
  readonly usage = "em-stl";
  readonly aliases = [":l"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return sourceStepCommand(context, "overLine", "Step over line");
  }
}

type StepIntoTargetArgs = { routine: string };

export class StepIntoTargetMachineCommand extends IdeCommandBase<StepIntoTargetArgs> {
  readonly id = "em-sit";
  readonly description = "Step into the named routine the current statement calls, running its other calls through";
  readonly usage = "em-sit <routine>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "routine" }]
  };

  async execute(context: IdeCommandContext, args: StepIntoTargetArgs): Promise<IdeCommandResult> {
    const result = context.store.getState().compilation?.result;
    if (!hasSourceLevelDebug(result)) return commandError("The program has no source-level debug information");
    const wanted = args.routine.toLowerCase();
    const target = result.sourceLevelDebug.callables.findIndex((c) => c.name.toLowerCase() === wanted);
    if (target < 0) return commandError(`No routine named '${args.routine}'`);
    return sourceStepCommand(context, "intoTarget", `Step into ${result.sourceLevelDebug.callables[target].name}`, {
      targetCallable: target
    });
  }
}

type RunToFrameArgs = { frame: number };

export class RunToFrameMachineCommand extends IdeCommandBase<RunToFrameArgs> {
  readonly id = "em-rtf";
  readonly description = "Run until control returns to the given frame of the call stack (1: the caller)";
  readonly usage = "em-rtf <frame>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "frame", type: "number", minValue: 1 }]
  };

  async execute(context: IdeCommandContext, args: RunToFrameArgs): Promise<IdeCommandResult> {
    return sourceStepCommand(context, "runToFrame", `Run to frame ${args.frame}`, { targetFrame: args.frame });
  }
}

type ErrorStopArgs = { mode: string };

export class ErrorStopsMachineCommand extends IdeCommandBase<ErrorStopArgs> {
  readonly id = "em-err";
  readonly description =
    "Turns runtime-error stops on or off: a debug run of a Klive BASIC program stops where it raises a BASIC error";
  readonly usage = "em-err <on|off>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "mode" }]
  };

  async execute(context: IdeCommandContext, args: ErrorStopArgs): Promise<IdeCommandResult> {
    const mode = `${args.mode}`.toLowerCase();
    if (mode !== "on" && mode !== "off") return commandError("Use 'on' or 'off'");
    await context.mainApi.setGlobalSettingsValue(SETTING_EMU_STOP_ON_ERRORS, mode === "on");
    writeSuccessMessage(context.output, mode === "on" ? "Debug runs stop at runtime errors" : "Runtime errors go to the ROM's report");
    return commandSuccess;
  }
}

type SourceSteppingArgs = { mode: string; "-i"?: boolean };

export class SourceSteppingMachineCommand extends IdeCommandBase<SourceSteppingArgs> {
  readonly id = "em-src";
  readonly description =
    "Selects source stepping (on) or Z80 instruction stepping (off) for programs with source-level debug info; -i also stops inside interrupt handlers";
  readonly usage = "em-src <on|off> [-i]";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "mode" }],
    commandOptions: ["-i"]
  };

  async execute(context: IdeCommandContext, args: SourceSteppingArgs): Promise<IdeCommandResult> {
    const mode = `${args.mode}`.toLowerCase();
    if (mode !== "on" && mode !== "off") return commandError("Use 'on' (source stepping) or 'off' (Z80 stepping)");
    await context.emuApi.setSourceStepping(mode === "on");
    if (mode === "on") await context.mainApi.setGlobalSettingsValue(SETTING_EMU_STEP_IN_INTERRUPTS, !!args["-i"]);
    writeSuccessMessage(
      context.output,
      mode === "on" ? `Source stepping${args["-i"] ? ", stopping in interrupt handlers" : ""}` : "Z80 instruction stepping"
    );
    return commandSuccess;
  }
}
