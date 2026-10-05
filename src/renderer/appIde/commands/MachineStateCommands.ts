import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { KliveStateHeader } from "@common/machineState/kliveStateFile";

import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";
import { machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { readKliveStateFile } from "@common/machineState/kliveStateFile";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";

/** The machines whose state Klive can save: every WASM machine (not the experimental C64) */
export const STATE_MACHINES = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_ZXNEXT,
  MI_Z88,
  MI_ZX80,
  MI_ZX81
];

/** Is this a Klive state file path (`.kls`, any case)? */
export function isMachineStatePath(path: string | undefined): boolean {
  return !!path && /\.kls$/i.test(path.trim());
}

export type StateSaveCommandArgs = { file: string; "-f"?: boolean };

/**
 * Saves the machine's complete state as a Klive state file
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.8). Any WASM machine; a running machine runs
 * on afterwards. An existing file is replaced only with `-f`.
 */
export class StateSaveCommand extends IdeCommandBase<StateSaveCommandArgs> {
  readonly id = "state-save";
  readonly description = "Saves the machine's complete state as a Klive state file (.kls; -f overwrites)";
  readonly aliases = ["ssave"];
  readonly usage = "state-save <state-file> [-f]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-f"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: StateSaveCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!args.file?.trim()) {
      messages.push(validationError("The state file path cannot be empty."));
    } else if (!isMachineStatePath(args.file)) {
      messages.push(validationError("The state file must have the .kls extension."));
    }
    const machineId = context.store.getState()?.emulatorState?.machineId;
    if (!machineId || !STATE_MACHINES.includes(machineId)) {
      messages.push(validationError("This machine cannot save its state."));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: StateSaveCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(`${file} already exists; use -f to replace it.`);
    }
    const machineId = context.store.getState()?.emulatorState?.machineId;
    let result: Awaited<ReturnType<typeof context.emuApi.saveMachineStateFile>>;
    try {
      const sdCard =
        machineId === MI_ZXNEXT ? await context.mainApi.getSdCardFingerprint() : undefined;
      result = await context.emuApi.saveMachineStateFile({
        kliveVersion: await versionOf(context),
        sdCard
      });
    } catch (err) {
      return commandError(`Could not save the state: ${messageOf(err)}`);
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, `Warning: ${warning}`, "yellow");
    }
    return commandSuccessWith(
      `Machine state saved to ${file} (${result.machineName}, PC $${toHexa4(result.pc)}).`,
      { warnings: result.warnings }
    );
  }
}

export type StateLoadCommandArgs = {
  file: string;
  "-r"?: boolean;
  "-d"?: boolean;
  "-y"?: boolean;
};

/**
 * Loads a Klive state file, switching to the machine it was saved on
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.8). With no option (or `-d`) it debugs,
 * stopping at the saved PC; `-r` runs. A Next state saved with another SD card content needs `-y`.
 */
export class StateLoadCommand extends IdeCommandBase<StateLoadCommandArgs> {
  readonly id = "state-load";
  readonly description =
    "Loads a Klive state file (.kls) and debugs it, stopping at its PC (-r runs it; -y accepts a changed SD card)";
  readonly aliases = ["sload"];
  readonly usage = "state-load <state-file> [-r | -d] [-y]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-r", "-d", "-y"]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: StateLoadCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!args.file?.trim()) {
      messages.push(validationError("The state file path cannot be empty."));
    } else if (!isMachineStatePath(args.file)) {
      messages.push(validationError("The file to load must be a Klive state file (.kls)."));
    }
    if (args["-r"] && args["-d"]) {
      messages.push(validationError("Use only one of -r and -d."));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: StateLoadCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    const mode = args["-r"] ? "run" : "debug";
    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(`Could not read ${file}: ${messageOf(err)}`);
    }
    let header: KliveStateHeader;
    let hasSdCard: boolean;
    try {
      const read = readKliveStateFile(bytes, { skipImage: true });
      header = read.header;
      hasSdCard = read.media.some((m) => m.id === MEDIA_SD_CARD);
    } catch (err) {
      return commandError(`${file} is not a valid state file: ${messageOf(err)}`);
    }
    const guard = machineStateProjectGuard(context.store.getState(), header.machineId);
    if (guard) return commandError(guard);

    let result: Awaited<ReturnType<typeof context.emuApi.loadMachineStateFile>>;
    try {
      const currentSdCard = hasSdCard ? await context.mainApi.getSdCardFingerprint() : undefined;
      result = await context.emuApi.loadMachineStateFile(file, bytes, mode, {
        currentSdCard,
        acceptChangedSdCard: !!args["-y"]
      });
    } catch (err) {
      return commandError(`Could not load ${file}: ${messageOf(err)}`);
    }
    if (result.needsConfirmation) {
      return commandError(`${result.needsConfirmation}. Use -y to load it anyway.`);
    }
    const state = context.store.getState();
    if (result.rebuilt) {
      writeMessage(context.output, `Machine switched to the ${result.machineName}.`, "cyan");
    }
    if (
      state?.project?.isKliveProject &&
      resolveModelId(header.machineId, state.emulatorState?.modelId) !== resolveModelId(header.machineId, header.modelId)
    ) {
      writeMessage(
        context.output,
        "Warning: the project's machine model differs from the state's; the emulator runs the state's until the project's machine is set again",
        "yellow"
      );
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, `Warning: ${warning}`, "yellow");
    }
    const done = mode === "run" ? "running" : "stopped at";
    return commandSuccessWith(
      `Machine state ${file} loaded${result.path === "szx" ? " from its .szx part" : ""}, ${done} PC $${toHexa4(result.pc)}.`
    );
  }
}

/**
 * Why a state cannot be loaded with the current project open, or undefined when it can (D10): a
 * project keeps its machine type, so a state of another machine type is refused
 */
export function machineStateProjectGuard(
  state: {
    project?: { isKliveProject?: boolean };
    emulatorState?: { machineId?: string };
  },
  stateMachineId: string
): string | undefined {
  if (!state?.project?.isKliveProject) return undefined;
  const machineId = state.emulatorState?.machineId;
  if (machineId === stateMachineId) return undefined;
  const nameOf = (id: string | undefined) =>
    machineRegistry.find((m) => m.machineId === id)?.displayName ?? id ?? "another machine";
  return (
    `The open project targets the ${nameOf(machineId)}, but this state was saved on the ` +
    `${nameOf(stateMachineId)}. Close the project or open a project for that machine.`
  );
}

async function versionOf(context: IdeCommandContext): Promise<string> {
  try {
    return await context.mainApi.getAppVersion();
  } catch {
    return "0.0.0";
  }
}

async function fileExists(context: IdeCommandContext, path: string): Promise<boolean> {
  try {
    await context.mainApi.readBinaryFile(path);
    return true;
  } catch {
    return false;
  }
}

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
