import { activateSidecarOf } from "@renderer/appIde/annotations/activeAnnotationSet";
import { annotationMachineFor } from "@common/annotations/bankSpace";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TIMEX, MI_SCORPION, MI_ZX80, MI_ZX81,
  MI_HT1080Z,
  MI_TVC,
  MI_ENTERPRISE
} from "@common/machines/constants";
import { isZx8081ProgramFileName, parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { ht1080zTapeErrorKey, isHt1080zTapeFor, parseHt1080zTapeFile } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { isTvcCasFileName, parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";
import { detectCasFormat, type CasFormat } from "@emu/machines/casFormat";
import { isEpTapeFileName, parseEpTapeFile } from "@emu/machines/enterprise/EpTapeFile";
import { analyzeHt1080zFile } from "../DocumentPanels/Ht1080zTape/ht1080zTapeView";
import { machineRegistry } from "@common/machines/machine-registry";
import { analyzeTape } from "../DocumentPanels/Tape/tapeView";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

export type TapeLoadCommandArgs = {
  file: string;
  "-r"?: boolean;
  "-d"?: boolean;
  /** Debug, stopping at the start address of an HT-1080Z machine-code tape (as `nex-run -e`) */
  "-e"?: boolean;
};

/** The machines a tape loads into from the IDE (`.plans/TAPE_VIEWER_PLAN.md` D4) */
export const TAPE_LOAD_MACHINES: readonly string[] = [
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_TIMEX,
  MI_SCORPION
];

/**
 * Why an HT-1080Z tape (`.cas`, `.cmd`) cannot be loaded into the current machine, or undefined when
 * it can (`.plans/HT1080Z_PLAN.md` §9).
 * @param state The IDE's state (the part read here)
 */
export function htTapeLoadGuard(state: { emulatorState?: { machineId?: string } }): string | undefined {
  return state.emulatorState?.machineId === MI_HT1080Z ? undefined : t("commands.tapeLoad.guard.htTape");
}

/**
 * Why a `.cas` cannot be loaded into the current machine, or undefined when it can: the HT-1080Z and
 * the Videoton TVC both keep their tapes in `.cas` files, each its own format.
 * @param state The IDE's state (the part read here)
 */
export function casTapeLoadGuard(state: { emulatorState?: { machineId?: string } }): string | undefined {
  const machineId = state.emulatorState?.machineId;
  return machineId === MI_HT1080Z || machineId === MI_TVC ? undefined : t("commands.tapeLoad.guard.casTape");
}

/**
 * Why a Videoton TVC tape (a `.cas` in the TVC's format) cannot be loaded into the current machine, or
 * undefined when it can.
 * @param state The IDE's state (the part read here)
 */
export function tvcTapeLoadGuard(state: { emulatorState?: { machineId?: string } }): string | undefined {
  return state.emulatorState?.machineId === MI_TVC ? undefined : t("commands.tapeLoad.guard.tvcTape");
}

/**
 * The guard for a `.cas` whose format was read from its bytes (`detectCasFormat`): only the machine
 * whose tape it is loads it; while the format is not known yet, either machine does.
 */
export function casFormatLoadGuard(
  format: CasFormat | undefined
): (state: { emulatorState?: { machineId?: string } }) => string | undefined {
  return format === "tvc" ? tvcTapeLoadGuard : format === "ht1080z" ? htTapeLoadGuard : casTapeLoadGuard;
}

/** The machines a ZX80/ZX81 program file (`.p`, `.81`, `.o`, `.80`) loads into */
export const PROGRAM_LOAD_MACHINES: readonly string[] = [MI_ZX81, MI_ZX80];

/**
 * Why a ZX80/ZX81 program file cannot be loaded into the current machine, or undefined when it can.
 * @param state The IDE's state (the part read here)
 */
export function programLoadGuard(state: { emulatorState?: { machineId?: string } }): string | undefined {
  const machineId = state.emulatorState?.machineId;
  return machineId && PROGRAM_LOAD_MACHINES.includes(machineId) ? undefined : t("commands.tapeLoad.guard.program");
}

/**
 * Tells whether a path names a `.tap` or `.tzx` tape file.
 * @param path The file path
 */
export function isTapeFilePath(path: string | undefined): boolean {
  const lower = path?.trim().toLowerCase() ?? "";
  return lower.endsWith(".tap") || lower.endsWith(".tzx");
}

/**
 * A tape path as the main process needs it: absolute. A relative path is taken as relative to the
 * open project's folder, the way the Explorer and `nav` name files - the main process would
 * otherwise resolve it against the app's own folder.
 * @param file The path given to the command
 * @param projectFolder The open project's folder, if any
 */
export function resolveTapePath(file: string, projectFolder?: string | null): string {
  const isAbsolute = file.startsWith("/") || file.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(file);
  if (isAbsolute || !projectFolder) return file;
  const separator = projectFolder.includes("\\") && !projectFolder.includes("/") ? "\\" : "/";
  return `${projectFolder.replace(/[\\/]+$/, "")}${separator}${file}`;
}

/**
 * Why a tape cannot be loaded into the current machine, or undefined when it can. Shared by the
 * command, the tape viewer's buttons and the Explorer's entries, so all three refuse the same way
 * (`.plans/TAPE_VIEWER_PLAN.md` §4.6).
 *
 * An allow-list, not the machine's tape-support flag: the ZX Spectrum Next supports tapes too, but
 * through NextZXOS and its own menu, which is not what these actions drive.
 * @param state The IDE's state (the part read here)
 */
export function tapeLoadGuard(state: {
  emulatorState?: { machineId?: string };
}): string | undefined {
  const machineId = state.emulatorState?.machineId;
  return machineId && TAPE_LOAD_MACHINES.includes(machineId)
    ? undefined
    : t("commands.tapeLoad.guard.tape");
}

/** The format of a `.cas` named by a `tape-load` argument, or undefined for another file or one not read */
async function readCasFormat(context: IdeCommandContext, file: string | undefined): Promise<CasFormat | undefined> {
  const path = file?.trim();
  if (!path || !/\.cas$/i.test(path)) return undefined;
  try {
    return detectCasFormat(await context.mainApi.readBinaryFile(resolveTapePath(path, context.store.getState().project?.folderPath)));
  } catch {
    return undefined;
  }
}

/**
 * Loads a `.tap` or `.tzx` file into the ZX Spectrum's tape deck (`.plans/TAPE_VIEWER_PLAN.md`
 * §4.6).
 *
 * With no option it only inserts the tape - as the emulator's "Select Tape File..." menu does, and
 * through the same code in the main process, so the Eject menu and the project's remembered tape
 * stay right. Inserting the tape already in the deck reloads it from its first block.
 *
 * `-r` then resets the machine and starts the tape loading: it types `LOAD ""` on a 48K and picks
 * the Tape Loader (Loader on a +2A/+3) on a 128K. `-d` does the same with the breakpoints armed.
 * `-e` debugs an HT-1080Z machine-code tape (a SYSTEM `.cas` or a `.cmd`) and stops at its start
 * address, with a one-shot breakpoint armed before the load - as `nex-run -e` stops at a NEX's entry.
 * Both then move the keyboard focus to the emulator window, where the loaded program expects it.
 */
export class TapeLoadCommand extends IdeCommandBase<TapeLoadCommandArgs> {
  readonly id = "tape-load";
  get description() {
    return t("commands.tapeLoad.description");
  }
  readonly aliases = ["tapeload"];
  readonly usage = "tape-load <tape-file> [-r | -d | -e]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-r", "-d", "-e"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: TapeLoadCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const isProgram = !!args.file?.trim() && isZx8081ProgramFileName(args.file.trim());
    const currentMachine = context.store.getState().emulatorState?.machineId;
    // --- A .bas is a tape by its content (HT1080Z_TAPE_VIEWERS_PLAN D1, D6): a tokenised one is refused
    // --- on another machine with the reason, a text one there is not a tape at all
    let basBytes: Uint8Array | undefined;
    if (args.file?.trim().toLowerCase().endsWith(".bas")) {
      try {
        basBytes = await context.mainApi.readBinaryFile(
          resolveTapePath(args.file.trim(), context.store.getState().project?.folderPath)
        );
      } catch {
        basBytes = undefined;
      }
    }
    // --- A .cas is the HT-1080Z's or the TVC's tape, in two formats: the bytes say whose, and only that
    // --- machine loads it
    const casFormat = await readCasFormat(context, args.file);
    if (casFormat && casFormat !== (currentMachine === MI_TVC ? "tvc" : currentMachine === MI_HT1080Z ? "ht1080z" : undefined)) {
      const name = machineRegistry.find((m) => m.machineId === currentMachine)?.displayName ?? currentMachine;
      const key =
        casFormat === "tvc"
          ? name
            ? "commands.tapeLoad.refusedTvcTape"
            : "commands.tapeLoad.refusedTvcTapeNoMachine"
          : name
            ? "commands.tapeLoad.refusedHtTape"
            : "commands.tapeLoad.refusedHtTapeNoMachine";
      messages.push(validationError(t(key, { machine: name })));
      return messages;
    }
    // --- A .cas on the Videoton TVC is the TVC's tape: it goes in the deck, and -r/-d boot BASIC and
    // --- type LOAD (`TvcWasmV2Machine.getTapeLoadFlow`). It names no start address for -e.
    const isEpTape = currentMachine === MI_ENTERPRISE && !!args.file?.trim() && isEpTapeFileName(args.file.trim());
    if ((currentMachine === MI_TVC && !!args.file?.trim() && isTvcCasFileName(args.file.trim())) || isEpTape) {
      if ([args["-r"], args["-d"], args["-e"]].filter(Boolean).length > 1) {
        messages.push(validationError(t("commands.tapeLoad.oneMode")));
      } else if (args["-e"]) {
        messages.push(validationError(t("commands.tapeLoad.tvcNoEntry")));
      }
      return messages;
    }
    const isHtTape = !!args.file?.trim() && isHt1080zTapeFor(args.file.trim(), currentMachine, basBytes);
    if (!args.file?.trim()) {
      messages.push(validationError(t("commands.tapeLoad.emptyPath")));
    } else if (!isTapeFilePath(args.file) && !isProgram && !isHtTape) {
      messages.push(validationError(t("commands.tapeLoad.wrongType")));
    }
    if ([args["-r"], args["-d"], args["-e"]].filter(Boolean).length > 1) {
      messages.push(validationError(t("commands.tapeLoad.oneMode")));
    }
    // --- Only an HT-1080Z machine-code tape names its start address
    if (args["-e"] && args.file?.trim() && !isHtTape) {
      messages.push(validationError(t("commands.tapeLoad.entryHtOnly")));
    }
    // --- An HT-1080Z tape loads into the HT only (`.plans/HT1080Z_PLAN.md` §9)
    if (isHtTape) {
      if (currentMachine !== MI_HT1080Z) {
        const name = machineRegistry.find((m) => m.machineId === currentMachine)?.displayName ?? currentMachine;
        messages.push(
          validationError(
            name ? t("commands.tapeLoad.refusedHtTape", { machine: name }) : t("commands.tapeLoad.refusedHtTapeNoMachine")
          )
        );
      }
      return messages;
    }
    const guard = isProgram ? programLoadGuard(context.store.getState()) : tapeLoadGuard(context.store.getState());
    if (guard) {
      const machineId = context.store.getState().emulatorState?.machineId;
      const name = machineRegistry.find((m) => m.machineId === machineId)?.displayName ?? machineId;
      const key = isProgram
        ? name
          ? "commands.tapeLoad.refusedProgram"
          : "commands.tapeLoad.refusedProgramNoMachine"
        : name
          ? "commands.tapeLoad.refusedTape"
          : "commands.tapeLoad.refusedTapeNoMachine";
      messages.push(validationError(t(key, { machine: name })));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: TapeLoadCommandArgs): Promise<IdeCommandResult> {
    const file = resolveTapePath(args.file.trim(), context.store.getState().project?.folderPath);

    // --- Check the tape here, where the reason can be shown: the emulator only reports a bad tape
    // --- in a message box
    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(t("commands.tapeLoad.readFailed", { file, error: messageOf(err) }));
    }
    // --- A Videoton TVC tape, or an Enterprise one: checked as the emulator reads it, then inserted
    const runningMachine = context.store.getState().emulatorState?.machineId;
    const epTape = runningMachine === MI_ENTERPRISE && isEpTapeFileName(file);
    if ((runningMachine === MI_TVC && isTvcCasFileName(file)) || epTape) {
      try {
        if (epTape) parseEpTapeFile(bytes);
        else parseTvcCasFile(bytes, file);
      } catch {
        return commandError(epTape ? t("emu.media.tape.epNotTape", { file }) : t("emu.media.tape.tvcNotCas", { file }));
      }
      const tvcError = await context.mainApi.setTapeFile(file);
      if (tvcError) return commandError(tvcError);
      if (!args["-r"] && !args["-d"]) return commandSuccessWith(t("commands.tapeLoad.inserted", { file }));
      try {
        await context.emuApi.startTapeLoad(!!args["-d"]);
      } catch (err) {
        return commandError(t("commands.tapeLoad.startFailed", { file, error: messageOf(err) }));
      }
      try {
        await context.mainApi.focusEmuWindow();
      } catch {
        // --- Intentionally ignored, as below
      }
      return commandSuccessWith(
        args["-d"] ? t("commands.tapeLoad.loadingDebug", { file }) : t("commands.tapeLoad.loading", { file })
      );
    }
    // --- An HT-1080Z tape: checked as the emulator reads it, so a bad one is refused here with its reason
    const isHtTape = isHt1080zTapeFor(file, context.store.getState().emulatorState?.machineId, bytes);
    if (isHtTape) {
      try {
        parseHt1080zTapeFile(bytes, file);
      } catch (err) {
        return commandError(t(ht1080zTapeErrorKey(err), { file }));
      }
    }
    // --- A ZX80/ZX81 program goes into the deck as it is; the ROM's LOAD reads it
    const isProgram = isZx8081ProgramFileName(file);
    if (isProgram && !parseZxProgramFile(bytes, file)) {
      return commandError(t("commands.tapeLoad.badProgram", { file }));
    }
    const { analysis, error } =
      isProgram || isHtTape ? { analysis: undefined, error: undefined } : analyzeTape(bytes);
    if (!isProgram && !isHtTape && !analysis) {
      return commandError(t("commands.tapeLoad.badTape", { file, error }));
    }

    const insertError = await context.mainApi.setTapeFile(file);
    if (insertError) {
      return commandError(insertError);
    }
    // --- A ZX80/ZX81 program loads at a fixed address, so it is a memory image like a snapshot:
    // --- `<file>.dis` becomes the live annotation set (created on the first edit). A Spectrum tape
    // --- has no such hook - what it loads, and where, is up to the loader it carries.
    if (isProgram) {
      const machine = annotationMachineFor(context.store.getState().emulatorState?.machineId);
      activateSidecarOf(file, machine === "zx80" ? "zx80" : "zx81", "tape");
    }
    if (analysis && analysis.summary.unplayableCount > 0) {
      writeMessage(
        context.output,
        t("commands.tapeLoad.unplayable", { count: analysis.summary.unplayableCount }),
        "yellow"
      );
    }

    // --- `-e`: the start address the tape names, and a one-shot stop there. Session-owned, so it
    // --- fires during the load flow, stays out of the project, and is gone once it has fired.
    const debug = !!args["-d"] || !!args["-e"];
    if (args["-e"]) {
      const entry = isHtTape ? analyzeHt1080zFile(bytes, file).analysis?.entry : undefined;
      if (entry === undefined) {
        return commandError(t("commands.tapeLoad.entryNotSystem", { file }));
      }
      await context.emuApi.setBreakpoint({
        address: entry,
        exec: true,
        oneShot: true,
        runTo: true,
        owner: { kind: "session" }
      });
      writeMessage(context.output, t("commands.tapeLoad.entryBreak", { address: `$${toHexa4(entry)}` }), "green");
    }

    const run = args["-r"] || debug;
    if (!run) {
      return commandSuccessWith(t("commands.tapeLoad.inserted", { file }));
    }

    if (context.store.getState().emulatorState?.machineId === MI_SPECTRUM_3E) {
      writeMessage(
        context.output,
        t("commands.tapeLoad.plus3Note"),
        "cyan"
      );
    }
    try {
      await context.emuApi.startTapeLoad(debug);
    } catch (err) {
      return commandError(t("commands.tapeLoad.startFailed", { file, error: messageOf(err) }));
    }

    // --- The machine now waits for keys (a game's "press any key", a 128K menu): hand the keyboard
    // --- to the emulator, or Space and Enter go to the IDE that launched the load. Best effort - a
    // --- window that cannot be focused does not make the load fail.
    try {
      await context.mainApi.focusEmuWindow();
    } catch {
      // --- Intentionally ignored
    }
    return commandSuccessWith(
      debug ? t("commands.tapeLoad.loadingDebug", { file }) : t("commands.tapeLoad.loading", { file })
    );
  }
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
