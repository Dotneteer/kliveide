import {
  SETTING_EMU_JUST_MY_CODE,
  SETTING_EMU_STEP_IN_INTERRUPTS,
  SETTING_EMU_STOP_ON_ERRORS
} from "@common/settings/setting-const";
import type { MachineCommand } from "@abstractions/MachineCommand";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { SourceStepKind } from "@emu/machines/SourceStepDecision";
import { hasSourceLevelDebug } from "@renderer/appIde/utils/compiler-utils";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

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
  get description() {
    return t("commands.machine.start.description");
  }
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
      writeSuccessMessage(context.output, t("commands.machine.started"));
      return commandSuccess;
    }
    return commandError(t("commands.machine.cannotStart"));
  }
}

export class PauseMachineCommand extends IdeCommandBase {
  readonly id = "em-pause";
  get description() {
    return t("commands.machine.pause.description");
  }
  readonly usage = "em-pause";
  readonly aliases = [":p"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = await getLiveMachineState(context);
    if (machineState === MachineControllerState.Running) {
      const cpuState = await context.emuApi.getCpuState({ present: true });
      await context.emuApi.issueMachineCommand("pause");
      writeSuccessMessage(
        context.output,
        t("commands.machine.paused", { pc: toHexa4(cpuState.pc) })
      );
      return commandSuccess;
    }
    return commandError(t("commands.machine.cannotPause"));
  }
}

export class StopMachineCommand extends IdeCommandBase {
  readonly id = "em-stop";
  get description() {
    return t("commands.machine.stop.description");
  }
  readonly usage = "em-stop";
  readonly aliases = [":h"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      const cpuState = await context.emuApi.getCpuState({ present: true });
      await context.emuApi.issueMachineCommand("stop");
      writeSuccessMessage(
        context.output,
        t("commands.machine.stopped", { pc: toHexa4(cpuState.pc) })
      );
      return commandSuccess;
    }
    return commandError(t("commands.machine.cannotStop"));
  }
}

export class RestartMachineCommand extends IdeCommandBase {
  readonly id = "em-restart";
  get description() {
    return t("commands.machine.restart.description");
  }
  readonly usage = "em-restart";
  readonly aliases = [":r"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineState = await getLiveMachineState(context);
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      await context.emuApi.issueMachineCommand("restart");
      writeSuccessMessage(context.output, t("commands.machine.restarted"));
      return commandSuccess;
    }
    return commandError(t("commands.machine.cannotRestart"));
  }
}

export class StartDebugMachineCommand extends IdeCommandBase {
  readonly id = "em-debug";
  get description() {
    return t("commands.machine.debug.description");
  }
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
      writeSuccessMessage(context.output, t("commands.machine.startedDebug"));
      return commandSuccess;
    }
    return commandError(t("commands.machine.cannotStart"));
  }
}

export class StepIntoMachineCommand extends IdeCommandBase {
  readonly id = "em-sti";
  get description() {
    return t("commands.machine.stepInto.description");
  }
  readonly usage = "em-sti";
  readonly aliases = [":"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepInto", "commands.machine.stepInto.done");
  }
}

export class StepOverMachineCommand extends IdeCommandBase {
  readonly id = "em-sto";
  get description() {
    return t("commands.machine.stepOver.description");
  }
  readonly usage = "em-sto";
  readonly aliases = ["."];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepOver", "commands.machine.stepOver.done");
  }
}

export class StepOutMachineCommand extends IdeCommandBase {
  readonly id = "em-out";
  get description() {
    return t("commands.machine.stepOut.description");
  }
  readonly usage = "em-out";
  readonly aliases = [":o"];

  async execute (context: IdeCommandContext): Promise<IdeCommandResult> {
    return stepCommand(context, "stepOut", "commands.machine.stepOut.done");
  }
}

async function stepCommand (
  context: IdeCommandContext,
  cmd: MachineCommand,
  /** The whole result line of this step ("Step into at PC=$...") */
  doneKey: MessageKey
): Promise<IdeCommandResult> {
  const machineState = await getLiveMachineState(context);
  if (machineState === MachineControllerState.Paused) {
    const cpuState = await context.emuApi.getCpuState({ present: true });
    await context.emuApi.issueMachineCommand(cmd);
    writeSuccessMessage(
      context.output,
      t(doneKey, { pc: toHexa4(cpuState.pc) })
    );
    return commandSuccess;
  }
  return commandError(t("commands.machine.mustBePaused"));
}

// =================================================================================================
// Source-level stepping (plan §10.2.8): for a program with source-level debug info, such as one
// Klive BASIC built. Step Into/Over/Out step statements while Source stepping is on (`em-src`).

/** The paused machine's source-level step, or why it cannot run. */
async function sourceStepCommand(
  context: IdeCommandContext,
  kind: SourceStepKind,
  /** The result line, already translated */
  name: string,
  options: { targetFrame?: number; targetCallable?: number } = {}
): Promise<IdeCommandResult> {
  const machineState = await getLiveMachineState(context);
  if (machineState !== MachineControllerState.Paused) return commandError(t("commands.machine.mustBePaused"));
  if (!hasSourceLevelDebug(context.store.getState().compilation?.result)) {
    return commandError(t("commands.machine.noSourceDebugBuild"));
  }
  await context.emuApi.sourceStep(kind, options);
  writeSuccessMessage(context.output, name);
  return commandSuccess;
}

export class StepOverLineMachineCommand extends IdeCommandBase {
  readonly id = "em-stl";
  get description() {
    return t("commands.machine.stepOverLine.description");
  }
  readonly usage = "em-stl";
  readonly aliases = [":l"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return sourceStepCommand(context, "overLine", t("commands.machine.stepOverLine.done"));
  }
}

type StepIntoTargetArgs = { routine: string };

export class StepIntoTargetMachineCommand extends IdeCommandBase<StepIntoTargetArgs> {
  readonly id = "em-sit";
  get description() {
    return t("commands.machine.stepIntoTarget.description");
  }
  readonly usage = "em-sit <routine>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "routine" }]
  };

  async execute(context: IdeCommandContext, args: StepIntoTargetArgs): Promise<IdeCommandResult> {
    const result = context.store.getState().compilation?.result;
    if (!hasSourceLevelDebug(result)) return commandError(t("commands.machine.noSourceDebug"));
    const wanted = args.routine.toLowerCase();
    const target = result.sourceLevelDebug.callables.findIndex((c) => c.name.toLowerCase() === wanted);
    if (target < 0) return commandError(t("commands.machine.noRoutine", { routine: args.routine }));
    return sourceStepCommand(context, "intoTarget", t("commands.machine.stepIntoTarget.done", { routine: result.sourceLevelDebug.callables[target].name }), {
      targetCallable: target
    });
  }
}

type RunToFrameArgs = { frame: number };

export class RunToFrameMachineCommand extends IdeCommandBase<RunToFrameArgs> {
  readonly id = "em-rtf";
  get description() {
    return t("commands.machine.runToFrame.description");
  }
  readonly usage = "em-rtf <frame>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "frame", type: "number", minValue: 1 }]
  };

  async execute(context: IdeCommandContext, args: RunToFrameArgs): Promise<IdeCommandResult> {
    return sourceStepCommand(context, "runToFrame", t("commands.machine.runToFrame.done", { frame: String(args.frame) }), { targetFrame: args.frame });
  }
}

type ErrorStopArgs = { mode: string };

export class ErrorStopsMachineCommand extends IdeCommandBase<ErrorStopArgs> {
  readonly id = "em-err";
  get description() {
    return t("commands.machine.errorStops.description");
  }
  readonly usage = "em-err <on|off>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "mode" }]
  };

  async execute(context: IdeCommandContext, args: ErrorStopArgs): Promise<IdeCommandResult> {
    const mode = `${args.mode}`.toLowerCase();
    if (mode !== "on" && mode !== "off") return commandError(t("commands.machine.useOnOff"));
    await context.mainApi.setGlobalSettingsValue(SETTING_EMU_STOP_ON_ERRORS, mode === "on");
    writeSuccessMessage(context.output, mode === "on" ? t("commands.machine.errorStops.on") : t("commands.machine.errorStops.off"));
    return commandSuccess;
  }
}

export class JustMyCodeMachineCommand extends IdeCommandBase<ErrorStopArgs> {
  readonly id = "em-jmc";
  get description() {
    return t("commands.machine.justMyCode.description");
  }
  readonly usage = "em-jmc <on|off>";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "mode" }]
  };

  async execute(context: IdeCommandContext, args: ErrorStopArgs): Promise<IdeCommandResult> {
    const mode = `${args.mode}`.toLowerCase();
    if (mode !== "on" && mode !== "off") return commandError(t("commands.machine.useOnOff"));
    await context.mainApi.setGlobalSettingsValue(SETTING_EMU_JUST_MY_CODE, mode === "on");
    writeSuccessMessage(context.output, mode === "on" ? t("commands.machine.justMyCode.on") : t("commands.machine.justMyCode.off"));
    return commandSuccess;
  }
}

type SourceSteppingArgs = { mode: string; "-i"?: boolean };

export class SourceSteppingMachineCommand extends IdeCommandBase<SourceSteppingArgs> {
  readonly id = "em-src";
  get description() {
    return t("commands.machine.sourceStepping.description");
  }
  readonly usage = "em-src <on|off> [-i]";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "mode" }],
    commandOptions: ["-i"]
  };

  async execute(context: IdeCommandContext, args: SourceSteppingArgs): Promise<IdeCommandResult> {
    const mode = `${args.mode}`.toLowerCase();
    if (mode !== "on" && mode !== "off") return commandError(t("commands.machine.sourceStepping.useOnOff"));
    await context.emuApi.setSourceStepping(mode === "on");
    if (mode === "on") await context.mainApi.setGlobalSettingsValue(SETTING_EMU_STEP_IN_INTERRUPTS, !!args["-i"]);
    writeSuccessMessage(
      context.output,
      mode === "on"
        ? t(args["-i"] ? "commands.machine.sourceStepping.onInterrupts" : "commands.machine.sourceStepping.on")
        : t("commands.machine.sourceStepping.off")
    );
    return commandSuccess;
  }
}
