import { hasDivMmc } from "@common/machines/divMmc";
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
  MI_SCORPION,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_HT1080Z,
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
import { t } from "@common/i18n/i18n";

/** The machines whose state Klive can save: every WASM machine (not the experimental C64) */
export const STATE_MACHINES = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION,
  MI_ZXNEXT,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_HT1080Z
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
  get description() {
    return t("commands.state.save.description");
  }
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
      messages.push(validationError(t("commands.state.emptyPath")));
    } else if (!isMachineStatePath(args.file)) {
      messages.push(validationError(t("commands.state.save.wrongType")));
    }
    const machineId = context.store.getState()?.emulatorState?.machineId;
    if (!machineId || !STATE_MACHINES.includes(machineId)) {
      messages.push(validationError(t("commands.state.save.unsupported")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: StateSaveCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(t("commands.state.fileExists", { file }));
    }
    const machineId = context.store.getState()?.emulatorState?.machineId;
    let result: Awaited<ReturnType<typeof context.emuApi.saveMachineStateFile>>;
    try {
      // --- The Next's card, or a DivMMC's (DISK_IMAGES_AND_FILE_SYSTEMS_PLAN C5)
      const emulatorState = context.store.getState()?.emulatorState;
      const sdCard =
        machineId === MI_ZXNEXT || hasDivMmc(machineId, emulatorState?.modelId, emulatorState?.config)
          ? await context.mainApi.getSdCardFingerprint()
          : undefined;
      result = await context.emuApi.saveMachineStateFile({
        kliveVersion: await versionOf(context),
        sdCard
      });
    } catch (err) {
      return commandError(t("commands.state.save.failed", { error: messageOf(err) }));
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(t("commands.state.writeFailed", { file, error: messageOf(err) }));
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, t("commands.state.warning", { warning }), "yellow");
    }
    return commandSuccessWith(
      t("commands.state.save.saved", { file, machine: result.machineName, pc: `$${toHexa4(result.pc)}` }),
      { warnings: result.warnings }
    );
  }
}

/** The `value` of a `state-load` that needs `-y`: why (the File menu asks the user with it) */
export type StateLoadConfirmation = { needsConfirmation: string };

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
  get description() {
    return t("commands.state.load.description");
  }
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
      messages.push(validationError(t("commands.state.emptyPath")));
    } else if (!isMachineStatePath(args.file)) {
      messages.push(validationError(t("commands.state.load.wrongType")));
    }
    if (args["-r"] && args["-d"]) {
      messages.push(validationError(t("commands.state.load.oneMode")));
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
      return commandError(t("commands.state.readFailed", { file, error: messageOf(err) }));
    }
    let header: KliveStateHeader;
    let hasSdCard: boolean;
    try {
      const read = readKliveStateFile(bytes, { skipImage: true });
      header = read.header;
      hasSdCard = read.media.some((m) => m.id === MEDIA_SD_CARD);
    } catch (err) {
      return commandError(t("commands.state.load.invalid", { file, error: messageOf(err) }));
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
      return commandError(t("commands.state.load.failed", { file, error: messageOf(err) }));
    }
    if (result.needsConfirmation) {
      // --- The reason travels in `value` too: the File menu asks the user with it (no text matching)
      return commandError(t("commands.state.load.needsConfirmation", { reason: result.needsConfirmation }), {
        needsConfirmation: result.needsConfirmation
      } satisfies StateLoadConfirmation);
    }
    const state = context.store.getState();
    if (result.rebuilt) {
      writeMessage(context.output, t("commands.state.machineSwitched", { machine: result.machineName }), "cyan");
    }
    if (
      state?.project?.isKliveProject &&
      resolveModelId(header.machineId, state.emulatorState?.modelId) !== resolveModelId(header.machineId, header.modelId)
    ) {
      writeMessage(
        context.output,
        t("commands.state.load.modelDiffers"),
        "yellow"
      );
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, t("commands.state.warning", { warning }), "yellow");
    }
    const loaded = { file, pc: `$${toHexa4(result.pc)}`, part: result.path === "szx" ? "szx" : "state" };
    return commandSuccessWith(
      mode === "run" ? t("commands.state.load.loadedRunning", loaded) : t("commands.state.load.loadedStopped", loaded)
    );
  }
}

/**
 * Why a state cannot be loaded with the current project open, or undefined when it can (D10): a
 * project keeps its machine type, so a state of another machine type is refused
 * @param kind What is being loaded: a state file, or a debug recording (which carries one)
 */
export function machineStateProjectGuard(
  state: {
    project?: { isKliveProject?: boolean };
    emulatorState?: { machineId?: string };
  },
  stateMachineId: string,
  kind: "state" | "recording" = "state"
): string | undefined {
  if (!state?.project?.isKliveProject) return undefined;
  const machineId = state.emulatorState?.machineId;
  if (machineId === stateMachineId) return undefined;
  const nameOf = (id: string | undefined) =>
    machineRegistry.find((m) => m.machineId === id)?.displayName ?? id ?? t("commands.state.anotherMachine");
  const args = { machine: nameOf(machineId), saved: nameOf(stateMachineId) };
  return kind === "recording" ? t("commands.debugRecording.guard", args) : t("commands.state.guard", args);
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
