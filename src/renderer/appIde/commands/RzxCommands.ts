import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { mapRzxToKlive } from "@common/spectrum/rzx/rzxMapping";
import type { RzxFile } from "@common/spectrum/rzx/rzxModel";
import type { RzxPlayResult } from "@common/spectrum/rzx/rzxCommandTypes";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";
import { spectrumSnapshotProjectGuard } from "./SpectrumSnapshotCommand";
import { t } from "@common/i18n/i18n";

/*
 * The RZX commands (`.plans/RZX_PLAN.md` §1.6, §4.6):
 *  - `zx-rzx <file> [-d] [-s n]`: play a recording, or play it under the debugger, from segment n;
 *  - `zx-rzx-record`: record from the machine's current state (D16);
 *  - `zx-rzx-stop <file> [-f]`: stop recording, finalise and save;
 *  - `zx-rzx-rollback [n]`: roll back to the latest (or the n-th latest) rollback point;
 *  - `zx-rzx-point`: insert a rollback point at the next frame end;
 *  - `zx-rzx-video <file> [-t]`: render a recording to video, as fast as possible (-t: in real time).
 * The menus, the drop handler, the viewer and the Explorer all run these commands.
 */

const SPECTRUM_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E];

/** Tells whether a path names an RZX file */
export function isRzxPath(path: string | undefined): boolean {
  return !!path && /\.rzx$/i.test(path.trim());
}

type RzxFileArgs = { file: string };

/** Reads, parses and maps a recording; checks the project guard (D7 of the snapshot plan) */
async function loadRecording(
  context: IdeCommandContext,
  file: string,
  segment?: number
): Promise<{ bytes: Uint8Array; rzx: RzxFile; keepModel: boolean } | IdeCommandResult> {
  let bytes: Uint8Array;
  try {
    bytes = await context.mainApi.readBinaryFile(file);
  } catch (err) {
    return commandError(t("commands.rzx.readFailed", { file, error: messageOf(err) }));
  }
  let rzx: RzxFile;
  let machineId: string | undefined;
  try {
    rzx = parseRzxFile(bytes);
    machineId = mapRzxToKlive(rzx, segment ?? 0).mapping.machineId;
  } catch (err) {
    return commandError(t("commands.rzx.cannotPlay", { file, error: messageOf(err) }));
  }
  const state = context.store.getState();
  const guard = spectrumSnapshotProjectGuard(state, machineId, "recording");
  if (guard) return commandError(guard);
  return { bytes, rzx, keepModel: !!state.project?.isKliveProject };
}

function validateFile(context: IdeCommandContext, file: string | undefined): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  if (!file?.trim()) {
    messages.push(validationError(t("commands.rzx.emptyPath")));
  } else if (!isRzxPath(file)) {
    messages.push(validationError(t("commands.rzx.wrongType")));
  }
  const guard = spectrumSnapshotProjectGuard(context.store.getState(), undefined, "recording");
  if (guard) messages.push(validationError(guard));
  return messages;
}

function reportPlay(context: IdeCommandContext, result: RzxPlayResult): void {
  if (result.rebuilt) {
    writeMessage(context.output, t("commands.rzx.machineSwitched", { machine: result.machineName }), "cyan");
  }
  for (const warning of result.warnings) {
    writeMessage(context.output, t("commands.rzx.warning", { warning }), "yellow");
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxPlayCommandArgs = RzxFileArgs & { "-d"?: boolean; "-s"?: number };

export class RzxPlayCommand extends IdeCommandBase<RzxPlayCommandArgs> {
  readonly id = "zx-rzx";
  get description() {
    return t("commands.rzx.play.description");
  }
  readonly aliases = ["rzx"];
  readonly usage = "zx-rzx <rzx-file> [-d] [-s <segment>]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-d"],
    namedOptions: [{ name: "-s", type: "number" }]
  };

  async validateCommandArgs(context: IdeCommandContext, args: RzxPlayCommandArgs): Promise<ValidationMessage[]> {
    const messages = validateFile(context, args.file);
    if (args["-s"] !== undefined && (!Number.isInteger(args["-s"]) || args["-s"] < 1)) {
      messages.push(validationError(t("commands.rzx.segmentFromOne")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: RzxPlayCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    const segment = args["-s"] !== undefined ? args["-s"] - 1 : undefined;
    const loaded = await loadRecording(context, file, segment);
    if ("success" in loaded) return loaded;
    let result: RzxPlayResult;
    try {
      result = await context.emuApi.playRzx(file, loaded.bytes, args["-d"] ? "debug" : "run", {
        keepModel: loaded.keepModel,
        segment
      });
    } catch (err) {
      return commandError(t("commands.rzx.playFailed", { file, error: messageOf(err) }));
    }
    reportPlay(context, result);
    const played = {
      file,
      frames: result.frames,
      creator: result.creator,
      machine: result.machineName,
      pc: `$${toHexa4(result.pc)}`
    };
    return commandSuccessWith(
      args["-d"] ? t("commands.rzx.loadedDebug", played) : t("commands.rzx.loadedPlaying", played)
    );
  }
}

// ------------------------------------------------------------------------------------------------

export class RzxRecordCommand extends IdeCommandBase {
  readonly id = "zx-rzx-record";
  get description() {
    return t("commands.rzx.record.description");
  }
  readonly usage = "zx-rzx-record";

  async validateCommandArgs(context: IdeCommandContext): Promise<ValidationMessage[]> {
    const machineId = context.store.getState()?.emulatorState?.machineId;
    return !machineId || !SPECTRUM_MACHINES.includes(machineId)
      ? [validationError(t("commands.rzx.recordMachines"))]
      : [];
  }

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.startRzxRecording(await creatorOf(context));
      const started = { machine: result.machineName, pc: `$${toHexa4(result.pc)}` };
      return commandSuccessWith(
        result.tookOverPlayback ? t("commands.rzx.recordingTookOver", started) : t("commands.rzx.recordingStarted", started)
      );
    } catch (err) {
      return commandError(t("commands.rzx.recordFailed", { error: messageOf(err) }));
    }
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxStopCommandArgs = RzxFileArgs & { "-f"?: boolean };

export class RzxStopCommand extends IdeCommandBase<RzxStopCommandArgs> {
  readonly id = "zx-rzx-stop";
  get description() {
    return t("commands.rzx.stop.description");
  }
  readonly usage = "zx-rzx-stop <rzx-file> [-f]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-f"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: RzxStopCommandArgs): Promise<ValidationMessage[]> {
    return isRzxPath(args.file) ? [] : [validationError(t("commands.rzx.saveWrongType"))];
  }

  async execute(context: IdeCommandContext, args: RzxStopCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(t("commands.rzx.fileExists", { file }));
    }
    let result: Awaited<ReturnType<typeof context.emuApi.stopRzxRecording>>;
    try {
      result = await context.emuApi.stopRzxRecording();
    } catch (err) {
      return commandError(t("commands.rzx.stopFailed", { error: messageOf(err) }));
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(t("commands.rzx.writeFailed", { file, error: messageOf(err) }));
    }
    return commandSuccessWith(t("commands.rzx.saved", { file, frames: result.frames }), {
      frames: result.frames
    });
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxRollbackCommandArgs = { back?: number };

export class RzxRollbackCommand extends IdeCommandBase<RzxRollbackCommandArgs> {
  readonly id = "zx-rzx-rollback";
  get description() {
    return t("commands.rzx.rollback.description");
  }
  readonly usage = "zx-rzx-rollback [n]";

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "back", type: "number", minValue: 1 }]
  };

  async execute(context: IdeCommandContext, args: RzxRollbackCommandArgs): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.rollbackRzxRecording(args.back ?? 1);
      return commandSuccessWith(t("commands.rzx.rolledBack", { frame: result.frame, points: result.points }));
    } catch (err) {
      return commandError(t("commands.rzx.rollbackFailed", { error: messageOf(err) }));
    }
  }
}

export class RzxRollbackPointCommand extends IdeCommandBase {
  readonly id = "zx-rzx-point";
  get description() {
    return t("commands.rzx.point.description");
  }
  readonly usage = "zx-rzx-point";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.insertRzxRollbackPoint();
      return commandSuccessWith(t("commands.rzx.pointSet", { frame: result.frame + 1 }));
    } catch (err) {
      return commandError(t("commands.rzx.pointFailed", { error: messageOf(err) }));
    }
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxVideoCommandArgs = RzxFileArgs & { "-t"?: boolean };

export class RzxVideoCommand extends IdeCommandBase<RzxVideoCommandArgs> {
  readonly id = "zx-rzx-video";
  get description() {
    return t("commands.rzx.video.description");
  }
  readonly usage = "zx-rzx-video <rzx-file> [-t]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-t"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: RzxVideoCommandArgs): Promise<ValidationMessage[]> {
    const messages = validateFile(context, args.file);
    if (!context.store.getState()?.emulatorState?.screenRecordingAvailable) {
      messages.push(validationError(t("commands.rzx.noScreenRecording")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: RzxVideoCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    const loaded = await loadRecording(context, file);
    if ("success" in loaded) return loaded;
    let result: RzxPlayResult;
    try {
      result = await context.emuApi.renderRzxToVideo(file, loaded.bytes, {
        keepModel: loaded.keepModel,
        unthrottled: !args["-t"]
      });
    } catch (err) {
      return commandError(t("commands.rzx.renderFailed", { file, error: messageOf(err) }));
    }
    reportPlay(context, result);
    const rendering = { file, frames: result.frames };
    return commandSuccessWith(
      args["-t"] ? t("commands.rzx.renderingRealTime", rendering) : t("commands.rzx.renderingFast", rendering)
    );
  }
}

/** The program and version written into recordings */
export async function creatorOf(context: IdeCommandContext): Promise<{ name: string; major: number; minor: number }> {
  try {
    const [major, minor] = (await context.mainApi.getAppVersion()).split(".").map((part) => parseInt(part, 10) || 0);
    return { name: "Klive IDE", major: major ?? 0, minor: minor ?? 0 };
  } catch {
    return { name: "Klive IDE", major: 0, minor: 0 };
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
