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
    return commandError(`Could not read ${file}: ${messageOf(err)}`);
  }
  let rzx: RzxFile;
  let machineId: string | undefined;
  try {
    rzx = parseRzxFile(bytes);
    machineId = mapRzxToKlive(rzx, segment ?? 0).mapping.machineId;
  } catch (err) {
    return commandError(`${file} cannot be played: ${messageOf(err)}`);
  }
  const state = context.store.getState();
  const guard = spectrumSnapshotProjectGuard(state, machineId);
  if (guard) return commandError(guard.replace(/snapshot/g, "recording"));
  return { bytes, rzx, keepModel: !!state.project?.isKliveProject };
}

function validateFile(context: IdeCommandContext, file: string | undefined): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  if (!file?.trim()) {
    messages.push(validationError("The recording file path cannot be empty."));
  } else if (!isRzxPath(file)) {
    messages.push(validationError("The file must be an .rzx recording."));
  }
  const guard = spectrumSnapshotProjectGuard(context.store.getState());
  if (guard) messages.push(validationError(guard.replace(/snapshot/g, "recording")));
  return messages;
}

function reportPlay(context: IdeCommandContext, result: RzxPlayResult): void {
  if (result.rebuilt) {
    writeMessage(context.output, `Machine switched to the ${result.machineName}.`, "cyan");
  }
  for (const warning of result.warnings) {
    writeMessage(context.output, `Warning: ${warning}`, "yellow");
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxPlayCommandArgs = RzxFileArgs & { "-d"?: boolean; "-s"?: number };

export class RzxPlayCommand extends IdeCommandBase<RzxPlayCommandArgs> {
  readonly id = "zx-rzx";
  readonly description =
    "Plays an RZX input recording on the ZX Spectrum (-d: under the debugger, stopping at its first instruction; -s n: from segment n)";
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
      messages.push(validationError("The segment number starts at 1."));
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
      return commandError(`Could not play ${file}: ${messageOf(err)}`);
    }
    reportPlay(context, result);
    const how = args["-d"] ? `under the debugger, stopped at PC $${toHexa4(result.pc)}` : "playing";
    return commandSuccessWith(
      `RZX recording ${file} (${result.frames} frames, ${result.creator}) loaded on the ${result.machineName}, ${how}.`
    );
  }
}

// ------------------------------------------------------------------------------------------------

export class RzxRecordCommand extends IdeCommandBase {
  readonly id = "zx-rzx-record";
  readonly description =
    "Starts recording an RZX file from the ZX Spectrum's current state (a running or paused machine)";
  readonly usage = "zx-rzx-record";

  async validateCommandArgs(context: IdeCommandContext): Promise<ValidationMessage[]> {
    const machineId = context.store.getState()?.emulatorState?.machineId;
    return !machineId || !SPECTRUM_MACHINES.includes(machineId)
      ? [validationError("Only a ZX Spectrum 48K, 128K or +2E/+3E can record an RZX file.")]
      : [];
  }

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.startRzxRecording(await creatorOf(context));
      return commandSuccessWith(
        `RZX recording started on the ${result.machineName} at PC $${toHexa4(result.pc)}` +
          (result.tookOverPlayback ? ", taking over the playback." : ".")
      );
    } catch (err) {
      return commandError(`Could not start recording: ${messageOf(err)}`);
    }
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxStopCommandArgs = RzxFileArgs & { "-f"?: boolean };

export class RzxStopCommand extends IdeCommandBase<RzxStopCommandArgs> {
  readonly id = "zx-rzx-stop";
  readonly description = "Stops the RZX recording, finalises it and saves it (-f overwrites)";
  readonly usage = "zx-rzx-stop <rzx-file> [-f]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-f"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: RzxStopCommandArgs): Promise<ValidationMessage[]> {
    return isRzxPath(args.file) ? [] : [validationError("The file to save must be an .rzx file.")];
  }

  async execute(context: IdeCommandContext, args: RzxStopCommandArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(`${file} already exists; use -f to replace it.`);
    }
    let result: Awaited<ReturnType<typeof context.emuApi.stopRzxRecording>>;
    try {
      result = await context.emuApi.stopRzxRecording();
    } catch (err) {
      return commandError(`Could not stop the recording: ${messageOf(err)}`);
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }
    return commandSuccessWith(`RZX recording saved to ${file} (${result.frames} frames).`, {
      frames: result.frames
    });
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxRollbackCommandArgs = { back?: number };

export class RzxRollbackCommand extends IdeCommandBase<RzxRollbackCommandArgs> {
  readonly id = "zx-rzx-rollback";
  readonly description =
    "Rolls the RZX recording back to its latest rollback point (n: the n-th latest); the machine is paused there";
  readonly usage = "zx-rzx-rollback [n]";

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "back", type: "number", minValue: 1 }]
  };

  async execute(context: IdeCommandContext, args: RzxRollbackCommandArgs): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.rollbackRzxRecording(args.back ?? 1);
      return commandSuccessWith(
        `Rolled back to frame ${result.frame}; ${result.points} rollback point(s) left. Resume to record on.`
      );
    } catch (err) {
      return commandError(`Could not roll back: ${messageOf(err)}`);
    }
  }
}

export class RzxRollbackPointCommand extends IdeCommandBase {
  readonly id = "zx-rzx-point";
  readonly description = "Inserts a rollback point into the RZX recording at the next frame end";
  readonly usage = "zx-rzx-point";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    try {
      const result = await context.emuApi.insertRzxRollbackPoint();
      return commandSuccessWith(`A rollback point is set at the next frame end (frame ${result.frame + 1}).`);
    } catch (err) {
      return commandError(`Could not insert a rollback point: ${messageOf(err)}`);
    }
  }
}

// ------------------------------------------------------------------------------------------------

export type RzxVideoCommandArgs = RzxFileArgs & { "-t"?: boolean };

export class RzxVideoCommand extends IdeCommandBase<RzxVideoCommandArgs> {
  readonly id = "zx-rzx-video";
  readonly description =
    "Renders an RZX recording to video with the screen recorder's settings, as fast as possible (-t: in real time)";
  readonly usage = "zx-rzx-video <rzx-file> [-t]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-t"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: RzxVideoCommandArgs): Promise<ValidationMessage[]> {
    const messages = validateFile(context, args.file);
    if (!context.store.getState()?.emulatorState?.screenRecordingAvailable) {
      messages.push(validationError("Screen recording is not available (FFmpeg was not found)."));
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
      return commandError(`Could not render ${file}: ${messageOf(err)}`);
    }
    reportPlay(context, result);
    return commandSuccessWith(
      `Rendering ${file} (${result.frames} frames) to video${args["-t"] ? " in real time" : ", as fast as the emulator can"}; ` +
        "the video stops at the recording's end."
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
