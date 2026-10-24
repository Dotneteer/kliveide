import { hasDivMmc } from "@common/machines/divMmc";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { DebugRecordingFrom } from "@common/debugRecording/debugRecordingTypes";
import type { WatchInfo } from "@common/state/AppState";

import { MF_REVERSE_DEBUG, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  advancedDebuggingOffMessage,
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
import { t, uiLocale } from "@common/i18n/i18n";

/*
 * Debug recordings (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.5): `debug-recording-save` writes the
 * reverse-debugging timeline to a `.klr` file, `debug-recording-load` opens one - the machine it was
 * made on, paused where it was saved, with Step Back, Reverse Continue and reverse watchpoints
 * reaching back to its start.
 */

/** The D18 notice: what a recording may give away */
export function recordingPrivacyNotice(): string {
  return t("commands.debugRecording.privacyNotice");
}

/** The `value` of a `debug-recording-load` that can open only the end state: why (the menu asks with it) */
export type DebugRecordingFallback = { fallbackRefusal: string };

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
  get description() {
    return t("commands.debugRecording.save.description");
  }
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
    if (!args.file?.trim()) messages.push(validationError(t("commands.debugRecording.emptyPath")));
    else if (!isDebugRecordingPath(args.file)) messages.push(validationError(t("commands.debugRecording.save.wrongType")));
    if (args["-from"] !== undefined && !parseRecordingFrom(String(args["-from"]))) {
      messages.push(validationError(t("commands.debugRecording.save.fromInvalid")));
    }
    if (!isAdvancedDebuggingEnabled(context.store.getState())) messages.push(validationError(advancedDebuggingOffMessage()));
    else if (!hasReverseDebugging(context)) messages.push(validationError(t("commands.debugRecording.save.unsupported")));
    return messages;
  }

  async execute(context: IdeCommandContext, args: DebugRecordingSaveArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(t("commands.debugRecording.fileExists", { file }));
    }
    const state = context.store.getState();
    let result: Awaited<ReturnType<typeof context.emuApi.saveDebugRecording>>;
    try {
      // --- The Next's card, or a DivMMC's (DISK_IMAGES_AND_FILE_SYSTEMS_PLAN C5)
      const emu = state.emulatorState;
      const sdCard =
        emu?.machineId === MI_ZXNEXT || hasDivMmc(emu?.machineId, emu?.modelId, emu?.config)
          ? await context.mainApi.getSdCardFingerprint()
          : undefined;
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
      return commandError(t("commands.debugRecording.save.failed", { error: messageOf(err) }));
    }
    try {
      await context.mainApi.saveBinaryFile(file, result.bytes);
    } catch (err) {
      return commandError(t("commands.debugRecording.writeFailed", { file, error: messageOf(err) }));
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, t("commands.debugRecording.warning", { warning }), "yellow");
    }
    writeMessage(context.output, recordingPrivacyNotice(), "cyan");
    const locale = uiLocale();
    const size =
      result.bytes.length >= 1048576
        ? t("commands.debugRecording.save.sizeMb", {
            size: (result.bytes.length / 1048576).toLocaleString(locale, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1
            })
          })
        : t("commands.debugRecording.save.sizeKb", { size: Math.ceil(result.bytes.length / 1024) });
    const saved = {
      file,
      machine: result.machineName,
      time: formatReverseSeconds(result.seconds),
      records: result.records,
      keyframes: result.keyframes,
      size
    };
    return commandSuccessWith(
      result.fromPast ? t("commands.debugRecording.save.savedFromPast", saved) : t("commands.debugRecording.save.saved", saved),
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
  get description() {
    return t("commands.debugRecording.load.description");
  }
  readonly aliases = ["drload"];
  readonly usage = "debug-recording-load <file.klr> [-start] [-verify] [-nobreakpoints] [-y]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-start", "-verify", "-nobreakpoints", "-y"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: DebugRecordingLoadArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!isAdvancedDebuggingEnabled(context.store.getState())) messages.push(validationError(advancedDebuggingOffMessage()));
    else if (!args.file?.trim()) messages.push(validationError(t("commands.debugRecording.emptyPath")));
    else if (!isDebugRecordingPath(args.file)) messages.push(validationError(t("commands.debugRecording.load.wrongType")));
    return messages;
  }

  async execute(context: IdeCommandContext, args: DebugRecordingLoadArgs): Promise<IdeCommandResult> {
    const file = args.file.trim();
    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(t("commands.debugRecording.readFailed", { file, error: messageOf(err) }));
    }
    let machineId: string;
    let hasSdCard: boolean;
    try {
      const read = await readDebugRecording(bytes, { headerOnly: true });
      machineId = read.header.machineId;
      hasSdCard = read.media.some((m) => m.kind === "sd");
    } catch (err) {
      return commandError(t("commands.debugRecording.load.invalid", { file, error: messageOf(err) }));
    }
    const guard = machineStateProjectGuard(context.store.getState(), machineId, "recording");
    if (guard) return commandError(guard);

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
      return commandError(t("commands.debugRecording.load.failed", { file, error: messageOf(err) }));
    }
    if (result.path === "refused") {
      // --- The refusal travels in `value` too: the File menu offers the end state with it (no text matching)
      return commandError(t("commands.debugRecording.load.refused", { reason: result.refusal ?? "" }), {
        fallbackRefusal: result.refusal ?? ""
      } satisfies DebugRecordingFallback);
    }
    if (result.rebuilt) {
      writeMessage(context.output, t("commands.debugRecording.machineSwitched", { machine: result.machineName }), "cyan");
    }
    for (const warning of result.warnings) {
      writeMessage(context.output, t("commands.debugRecording.warning", { warning }), "yellow");
    }
    if (result.path === "state") {
      return commandSuccessWith(
        t("commands.debugRecording.load.endStateOnly", { reason: result.refusal ?? "", pc: `$${toHexa4(result.pc)}` })
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
      writeMessage(context.output, t("commands.debugRecording.warning", { warning: line }), "yellow");
    }
    if (result.verified) {
      writeMessage(
        context.output,
        t("commands.debugRecording.load.verified", {
          keyframes: result.verified.keyframes,
          seconds: (result.verified.ms / 1000).toLocaleString(uiLocale(), {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        }),
        "cyan"
      );
    }
    return commandSuccessWith(
      t("commands.debugRecording.load.opened", {
        file,
        time: formatReverseSeconds(result.seconds ?? 0),
        keyframes: result.keyframes,
        breakpoints: result.breakpointsAdded ?? 0,
        watches: addedWatches,
        extras: result.breakpointsAdded
          ? addedWatches
            ? "both"
            : "breakpoints"
          : addedWatches
            ? "watches"
            : "none",
        landed: result.landed === "start" || result.landed === "saved" ? result.landed : "end",
        pc: `$${toHexa4(result.pc)}`
      })
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
