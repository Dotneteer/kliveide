import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { DebugRecordingFrom } from "@common/debugRecording/debugRecordingTypes";
import { DEBUG_RECORDING_FALLBACK_HINT } from "@common/debugRecording/debugRecordingTypes";
import type { WatchInfo } from "@common/state/AppState";

import { MF_REVERSE_DEBUG, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  ADVANCED_DEBUGGING_OFF_MESSAGE,
  isAdvancedDebuggingEnabled
} from "@common/features/advancedDebugging";
import { isDebugRecordingPath, readDebugRecording } from "@common/debugRecording/debugRecordingFile";
import { formatReverseSeconds } from "@common/history/reverseDebugText";
import { addWatchAction } from "@common/state/actions";
import { machineStateProjectGuard } from "./MachineStateCommands";
import { collectRecordingSources, compareRecordingSources } from "./debugRecordingSources";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";

/*
 * Debug recordings (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.5): `debug-recording-save` writes the
 * reverse-debugging timeline to a `.klr` file, `debug-recording-load` opens one - the machine it was
 * made on, paused where it was saved, with Step Back, Reverse Continue and reverse watchpoints
 * reaching back to its start.
 */

/** The D18 notice: what a recording may give away */
export const RECORDING_PRIVACY_NOTICE =
  "A debug recording holds everything the machine was given - every key typed, every tape and SD card sector read - and, with -sources, the source files.";

export type DebugRecordingSaveArgs = {
  file: string;
  "-from"?: string;
  "-sparse"?: boolean;
  "-sources"?: boolean;
  "-note"?: string;
  "-f"?: boolean;
};

/** `-from`: `-42` steps back from the present, `#1234` a record's sequence number */
export function parseRecordingFrom(text: string): DebugRecordingFrom | undefined {
  const t = text.trim().replace("−", "-");
  const seq = /^#(\d+)$/.exec(t);
  if (seq) return { sequence: Number(seq[1]) };
  const step = /^-?(\d+)$/.exec(t);
  if (step && Number(step[1]) > 0) return { stepsBack: Number(step[1]) };
  return undefined;
}

function hasReverseDebugging(context: IdeCommandContext): boolean {
  const machineId = context.store.getState()?.emulatorState?.machineId;
  return !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_REVERSE_DEBUG];
}

/** `debug-recording-save <file>`: saves the reverse-debugging timeline */
export class DebugRecordingSaveCommand extends IdeCommandBase<DebugRecordingSaveArgs> {
  readonly id = "debug-recording-save";
  readonly description =
    "Saves the reverse-debugging session as a debug recording (.klr) that replays with the debugger attached (-f overwrites)";
  readonly aliases = ["drsave"];
  readonly usage = "debug-recording-save <file.klr> [-from <-n|#seq>] [-sparse] [-sources] [-f] [-note <text>]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    namedOptions: [{ name: "-from", type: "string" }],
    commandOptions: ["-sparse", "-sources", "-f"],
    rawTailOption: "-note"
  };

  async validateCommandArgs(context: IdeCommandContext, args: DebugRecordingSaveArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!args.file?.trim()) messages.push(validationError("The recording's file path cannot be empty."));
    else if (!isDebugRecordingPath(args.file)) messages.push(validationError("A debug recording must have the .klr extension."));
    if (args["-from"] !== undefined && !parseRecordingFrom(String(args["-from"]))) {
      messages.push(validationError("-from: use a step back (-42) or a sequence number (#1234)"));
    }
    if (!isAdvancedDebuggingEnabled(context.store.getState())) messages.push(validationError(ADVANCED_DEBUGGING_OFF_MESSAGE));
    else if (!hasReverseDebugging(context)) messages.push(validationError("This machine has no reverse debugging to record."));
    return messages;
  }

  async execute(context: IdeCommandContext, args: DebugRecordingSaveArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(`${file} already exists; use -f to replace it.`);
    }
    const state = context.store.getState();
    let result: Awaited<ReturnType<typeof context.emuApi.saveDebugRecording>>;
    try {
      const sdCard = state.emulatorState?.machineId === MI_ZXNEXT ? await context.mainApi.getSdCardFingerprint() : undefined;
      result = await context.emuApi.saveDebugRecording({
        kliveVersion: await versionOf(context),
        from: args["-from"] !== undefined ? parseRecordingFrom(String(args["-from"])) : undefined,
        sparse: !!args["-sparse"],
        note: args["-note"],
        sdCard,
        watches: state.watchExpressions ?? [],
        sources: await collectRecordingSources(context, !!args["-sources"])
      });
    } catch (err) {
      return commandError(`Could not save the recording: ${messageOf(err)}`);
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }
    for (const warning of result.warnings) writeMessage(context.output, `Warning: ${warning}`, "yellow");
    writeMessage(context.output, RECORDING_PRIVACY_NOTICE, "cyan");
    const size = result.bytes.length >= 1048576 ? `${(result.bytes.length / 1048576).toFixed(1)} MB` : `${Math.ceil(result.bytes.length / 1024)} KB`;
    return commandSuccessWith(
      `Debug recording ${file} saved (${result.machineName}): ${formatReverseSeconds(result.seconds)} of machine time, ` +
        `${result.records.toLocaleString("en-US")} instructions, ${result.keyframes} keyframes, ${size}` +
        `${result.fromPast ? "; it opens where the machine stands now, in the past" : ""}.`,
      { records: result.records, keyframes: result.keyframes, bytes: result.bytes.length }
    );
  }
}

export type DebugRecordingLoadArgs = {
  file: string;
  "-start"?: boolean;
  "-verify"?: boolean;
  "-nobreakpoints"?: boolean;
  "-y"?: boolean;
};

/** `debug-recording-load <file>`: opens a debug recording */
export class DebugRecordingLoadCommand extends IdeCommandBase<DebugRecordingLoadArgs> {
  readonly id = "debug-recording-load";
  readonly description =
    "Opens a debug recording (.klr): its machine, paused where it was saved, with its whole past (-start: at its start)";
  readonly aliases = ["drload"];
  readonly usage = "debug-recording-load <file.klr> [-start] [-verify] [-nobreakpoints] [-y]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-start", "-verify", "-nobreakpoints", "-y"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: DebugRecordingLoadArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!isAdvancedDebuggingEnabled(context.store.getState())) messages.push(validationError(ADVANCED_DEBUGGING_OFF_MESSAGE));
    else if (!args.file?.trim()) messages.push(validationError("The recording's file path cannot be empty."));
    else if (!isDebugRecordingPath(args.file)) messages.push(validationError("The file to open must be a debug recording (.klr)."));
    return messages;
  }

  async execute(context: IdeCommandContext, args: DebugRecordingLoadArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(`Could not read ${file}: ${messageOf(err)}`);
    }
    let machineId: string;
    let hasSdCard: boolean;
    try {
      const read = await readDebugRecording(bytes, { headerOnly: true });
      machineId = read.header.machineId;
      hasSdCard = read.media.some((m) => m.kind === "sd");
    } catch (err) {
      return commandError(`${file} is not a valid debug recording: ${messageOf(err)}`);
    }
    const guard = machineStateProjectGuard(context.store.getState(), machineId);
    if (guard) return commandError(guard.replace("this state was saved", "this recording was made"));

    let result: Awaited<ReturnType<typeof context.emuApi.loadDebugRecording>>;
    try {
      const currentSdCard = hasSdCard ? await context.mainApi.getSdCardFingerprint().catch(() => undefined) : undefined;
      result = await context.emuApi.loadDebugRecording(file, bytes, await versionOf(context), {
        land: args["-start"] ? "start" : "saved",
        verify: !!args["-verify"],
        noBreakpoints: !!args["-nobreakpoints"],
        acceptFallback: !!args["-y"],
        currentSdCard
      });
    } catch (err) {
      return commandError(`Could not open ${file}: ${messageOf(err)}`);
    }
    if (result.path === "refused") {
      return commandError(`${result.refusal}. ${DEBUG_RECORDING_FALLBACK_HINT}`);
    }
    if (result.rebuilt) writeMessage(context.output, `Machine switched to the ${result.machineName}.`, "cyan");
    for (const warning of result.warnings) writeMessage(context.output, `Warning: ${warning}`, "yellow");
    if (result.path === "state") {
      return commandSuccessWith(
        `${result.refusal}. Opened its end state only (no past), stopped at PC $${toHexa4(result.pc)}.`
      );
    }

    // --- The recording's watches are added, not replaced (D11)
    const watches = (result.watches ?? []) as WatchInfo[];
    const existing = new Set((context.store.getState().watchExpressions ?? []).map((w) => w.symbol));
    let addedWatches = 0;
    for (const w of watches) {
      if (!w?.symbol || existing.has(w.symbol)) continue;
      context.store.dispatch(addWatchAction(w));
      addedWatches++;
    }
    // --- Sources that differ are said before the first step (D13, T11)
    for (const line of await compareRecordingSources(context, result.sources)) {
      writeMessage(context.output, `Warning: ${line}`, "yellow");
    }
    if (result.verified) {
      writeMessage(
        context.output,
        `Verified: replayed from its start through ${result.verified.keyframes} keyframes in ${(result.verified.ms / 1000).toFixed(1)} s`,
        "cyan"
      );
    }
    const where =
      result.landed === "start" ? "at its start" : result.landed === "saved" ? "where it was saved, in its past" : "at its end";
    const extras = [
      result.breakpointsAdded ? `${result.breakpointsAdded} breakpoint${result.breakpointsAdded === 1 ? "" : "s"}` : "",
      addedWatches ? `${addedWatches} watch${addedWatches === 1 ? "" : "es"}` : ""
    ].filter(Boolean);
    return commandSuccessWith(
      `Debug recording ${file} opened: ${formatReverseSeconds(result.seconds ?? 0)} of machine time, ` +
        `${result.keyframes} keyframes${extras.length ? `, with ${extras.join(" and ")}` : ""}; paused ${where} (PC $${toHexa4(result.pc)}).`
    );
  }
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
