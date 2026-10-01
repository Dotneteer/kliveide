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
 * With no option the machine stands paused at the snapshot's PC. `-r` runs it. `-d` debugs it,
 * stopping at the snapshot's PC before that instruction runs. `-a` does what the file's `Autorun`
 * flag says, as OZvm does: run when it is set, debug-stop at PC when it is not. The emulator's
 * "Open Z88 snapshot" menu uses `-a`.
 *
 * The emulator makes the machine fit the snapshot, so loading may turn the current machine into a
 * Z88 or rebuild it with another internal RAM or LCD size. That is fine with no project open. A
 * project for another machine is refused rather than switched behind the user's back: the project
 * would record the Z88 on its next save.
 */
export class Z88SnapshotCommand extends IdeCommandBase<Z88SnapshotCommandArgs> {
  readonly id = "z88-snapshot";
  readonly description = "Loads a .z88 snapshot into the Cambridge Z88, optionally running or debugging it";
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
      messages.push(validationError("The snapshot file path cannot be empty."));
    } else if (!isZ88SnapshotPath(args.file)) {
      messages.push(validationError("The file to load must be a .z88 snapshot."));
    }

    const modes = ["-r", "-d", "-a"].filter((option) => args[option]);
    if (modes.length > 1) {
      messages.push(validationError(`Use only one of -r, -d and -a (got ${modes.join(", ")}).`));
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
      return commandError(`Could not read ${file}: ${messageOf(err)}`);
    }

    // --- -a needs the file's Autorun flag before the load decides what to do
    let mode: Z88SnapshotLoadMode = args["-r"] ? "run" : args["-d"] ? "debug" : "load";
    if (args["-a"]) {
      try {
        mode = parseZ88Snapshot(bytes).autorun ? "run" : "debug";
      } catch (err) {
        return commandError(`${file} is not a valid Z88 snapshot: ${messageOf(err)}`);
      }
    }

    let result: Awaited<ReturnType<typeof context.emuApi.loadZ88Snapshot>>;
    try {
      result = await context.emuApi.loadZ88Snapshot(bytes, mode);
    } catch (err) {
      return commandError(`Could not load ${file}: ${messageOf(err)}`);
    }

    if (result.rebuilt) {
      writeMessage(context.output, "The Z88 was set up again to fit the snapshot.", "cyan");
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, `Warning: ${warning}`, "yellow");
    }
    const done =
      mode === "run" ? "running" : mode === "debug" ? "stopped at" : "paused at";
    return commandSuccessWith(`Z88 snapshot ${file} loaded, ${done} PC $${toHexa4(result.pc)}.`);
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
    machineRegistry.find((m) => m.machineId === machineId)?.displayName ?? machineId ?? "another machine";
  return (
    `The open project targets ${machineName}; loading a Z88 snapshot would switch it to the ` +
    "Cambridge Z88. Close the project or open a Z88 project first."
  );
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
