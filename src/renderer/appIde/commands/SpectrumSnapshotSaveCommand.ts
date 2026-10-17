import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { SzxCreator } from "@common/spectrum/snapshot/szxWriter";

import { MI_SCORPION, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TIMEX } from "@common/machines/constants";
import { snapshotFormatOfName } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

export type SpectrumSnapshotSaveCommandArgs = {
  file: string;
  "-f"?: boolean;
};

/** The ZX Spectrum machines a snapshot can be saved from */
const SPECTRUM_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_TIMEX, MI_SCORPION];

/**
 * Saves the running ZX Spectrum 48K, 128K or +2E/+3E as a `.szx`, `.z80` or `.sna` snapshot
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.3).
 *
 * The file's extension picks the format; `.szx` keeps everything. What a format cannot hold is
 * listed as warnings (D3), and a state it would load back differently is refused. An existing file
 * is replaced only with `-f`. A running machine runs on after the save; a paused one stays paused.
 */
export class SpectrumSnapshotSaveCommand extends IdeCommandBase<SpectrumSnapshotSaveCommandArgs> {
  readonly id = "zx-snapshot-save";
  get description() {
    return t("commands.snapshotSave.description");
  }
  readonly aliases = ["zxsave"];
  readonly usage = "zx-snapshot-save <snapshot-file> [-f]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-f"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: SpectrumSnapshotSaveCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const file = args.file?.trim();
    if (!file) {
      messages.push(validationError(t("commands.snapshotSave.emptyPath")));
    } else if (!/\.(sna|z80|szx)$/i.test(file)) {
      messages.push(validationError(t("commands.snapshotSave.wrongType")));
    }
    const machineId = context.store.getState()?.emulatorState?.machineId;
    if (!machineId || !SPECTRUM_MACHINES.includes(machineId)) {
      messages.push(validationError(t("commands.snapshotSave.machines")));
    }
    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: SpectrumSnapshotSaveCommandArgs
  ): Promise<IdeCommandResult> {
    const file = args.file.trim();
    const format = snapshotFormatOfName(file)!;

    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(t("commands.snapshotSave.fileExists", { file }));
    }

    let result: Awaited<ReturnType<typeof context.emuApi.saveSpectrumSnapshot>>;
    try {
      result = await context.emuApi.saveSpectrumSnapshot(format, await creatorOf(context));
    } catch (err) {
      return commandError(t("commands.snapshotSave.saveFailed", { file, error: messageOf(err) }));
    }

    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(t("commands.snapshotSave.writeFailed", { file, error: messageOf(err) }));
    }

    for (const loss of result.losses) {
      writeMessage(context.output, t("commands.snapshotSave.warning", { warning: loss }), "yellow");
    }
    return commandSuccessWith(
      t("commands.snapshotSave.saved", {
        format: format.toUpperCase(),
        file,
        machine: result.machineName,
        pc: `$${toHexa4(result.pc)}`
      }),
      { format, losses: result.losses }
    );
  }
}

/** Klive as the `.szx` creator, with its version when the main process tells it */
async function creatorOf(context: IdeCommandContext): Promise<SzxCreator> {
  try {
    const [major, minor] = (await context.mainApi.getAppVersion())
      .split(".")
      .map((part) => parseInt(part, 10) || 0);
    return { name: "Klive IDE", major: major ?? 0, minor: minor ?? 0 };
  } catch {
    return { name: "Klive IDE", major: 0, minor: 0 };
  }
}

/** Does the file exist? (Reading it is the only probe the main process offers) */
async function fileExists(context: IdeCommandContext, path: string): Promise<boolean> {
  try {
    await context.mainApi.readBinaryFile(path);
    return true;
  } catch {
    return false;
  }
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
