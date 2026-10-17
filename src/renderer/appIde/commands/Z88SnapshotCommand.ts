import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { Z88SnapshotLoadMode } from "@common/z88/z88SnapshotLoadTypes";

import { MI_Z88 } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

export type Z88SnapshotCommandArgs = {
  file: string;
  "-r"?: boolean;
  "-d"?: boolean;
  "-a"?: boolean;
};

/**
 * Tells whether a path names a `.z88` snapshot file.
 * @param path The file path
 */
export function isZ88SnapshotPath(path: string | undefined): boolean {
  return !!path && path.trim().toLowerCase().endsWith(".z88");
}

/**
 * Loads a `.z88` (OZvm) snapshot into the Cambridge Z88 (`.plans/Z88_SNAPSHOT_PLAN.md` §4.6).
 *
 * With no option (or `-d`) it debugs the snapshot, stopping at its PC before that instruction runs.
 * `-r` runs it. `-a` does what the file's `Autorun` flag says, as OZvm does: run when it is set,
 * debug-stop at PC when it is not. The emulator's "Open Z88 snapshot" menu uses `-a`.
 *
 * There was a third mode, "load and stay paused at PC". It ended where debugging does and differed
 * only in that Continue then ran without breakpoints - nothing on screen told the two apart - so the
 * plain command now debugs. `-d` stays accepted, for the scripts and menus that pass it.
 *
 * The emulator makes the machine fit the snapshot, so loading may turn the current machine into a
 * Z88 or rebuild it with another internal RAM or LCD size. That is fine with no project open. A
 * project for another machine is refused rather than switched behind the user's back: the project
 * would record the Z88 on its next save.
 */
export class Z88SnapshotCommand extends IdeCommandBase<Z88SnapshotCommandArgs> {
  readonly id = "z88-snapshot";
  get description() {
    return t("commands.z88Snapshot.description");
  }
  readonly aliases = ["z88snap"];
  readonly usage = "z88-snapshot <z88-file> [-r | -d | -a]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-r", "-d", "-a"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: Z88SnapshotCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];

    if (!args.file?.trim()) {
      messages.push(validationError(t("commands.z88Snapshot.emptyPath")));
    } else if (!isZ88SnapshotPath(args.file)) {
      messages.push(validationError(t("commands.z88Snapshot.wrongType")));
    }

    const modes = ["-r", "-d", "-a"].filter((option) => args[option]);
    if (modes.length > 1) {
      messages.push(validationError(t("commands.z88Snapshot.oneMode", { options: modes.join(", ") })));
    }

    const guard = z88SnapshotProjectGuard(context.store.getState());
    if (guard) {
      messages.push(validationError(guard));
    }
    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: Z88SnapshotCommandArgs
  ): Promise<IdeCommandResult> {
    const file = args.file.trim();

    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(t("commands.z88Snapshot.readFailed", { file, error: messageOf(err) }));
    }

    // --- -a needs the file's Autorun flag before the load decides what to do
    let mode: Z88SnapshotLoadMode = args["-r"] ? "run" : "debug";
    if (args["-a"]) {
      try {
        mode = parseZ88Snapshot(bytes).autorun ? "run" : "debug";
      } catch (err) {
        return commandError(t("commands.z88Snapshot.invalid", { file, error: messageOf(err) }));
      }
    }

    let result: Awaited<ReturnType<typeof context.emuApi.loadZ88Snapshot>>;
    try {
      result = await context.emuApi.loadZ88Snapshot(bytes, mode);
    } catch (err) {
      return commandError(t("commands.z88Snapshot.loadFailed", { file, error: messageOf(err) }));
    }

    if (result.rebuilt) {
      writeMessage(context.output, t("commands.z88Snapshot.rebuilt"), "cyan");
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, t("commands.z88Snapshot.warning", { warning }), "yellow");
    }
    const loaded = { file, pc: `$${toHexa4(result.pc)}` };
    return commandSuccessWith(
      mode === "run" ? t("commands.z88Snapshot.loadedRunning", loaded) : t("commands.z88Snapshot.loadedStopped", loaded)
    );
  }
}

/**
 * Why a snapshot cannot be loaded with the current project open, or undefined when it can: a
 * project for another machine would be switched to the Z88. Shared by the command and the viewer's
 * buttons, so both refuse the same way.
 * @param state The IDE's state (the parts read here)
 */
export function z88SnapshotProjectGuard(state: {
  project?: { folderPath?: string | null; isKliveProject?: boolean };
  emulatorState?: { machineId?: string };
}): string | undefined {
  const machineId = state.emulatorState?.machineId;
  if (!state.project?.isKliveProject || machineId === MI_Z88) {
    return undefined;
  }
  const machineName =
    machineRegistry.find((m) => m.machineId === machineId)?.displayName ??
    machineId ??
    t("commands.z88Snapshot.anotherMachine");
  return t("commands.z88Snapshot.guard", { machine: machineName });
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
