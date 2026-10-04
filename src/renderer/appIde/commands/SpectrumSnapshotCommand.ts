import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SpectrumSnapshotLoadMode } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  parseSpectrumSnapshot,
  snapshotFormatOfName
} from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa4,
  validationError,
  writeMessage
} from "../services/ide-commands";

export type SpectrumSnapshotCommandArgs = {
  file: string;
  "-r"?: boolean;
  "-d"?: boolean;
};

/** The ZX Spectrum machines a snapshot can load on */
const SPECTRUM_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E];

/**
 * Tells whether a path names a ZX Spectrum snapshot (`.sna`, `.z80`, `.szx`; any case).
 * @param path The file path
 */
export function isSpectrumSnapshotPath(path: string | undefined): boolean {
  return !!path && !!snapshotFormatOfName(path.trim());
}

/**
 * Loads a ZX Spectrum `.sna`, `.z80` or `.szx` snapshot (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md`
 * §4.6).
 *
 * With no option (or `-d`) it debugs the snapshot, stopping at its PC before that instruction runs
 * (D4); `-r` runs it. The snapshot picks the machine (D2): with no project open the emulator
 * switches to it freely. A project is honoured (D7): one for another machine type is refused, and
 * one for the right type keeps its model, with a warning when the snapshot prefers another.
 *
 * A `.szx` file may link +3 disk images by name; the command reads them (as given, or next to the
 * snapshot) and hands them to the emulator, which inserts them before the state is restored.
 */
export class SpectrumSnapshotCommand extends IdeCommandBase<SpectrumSnapshotCommandArgs> {
  readonly id = "zx-snapshot";
  readonly description =
    "Loads a ZX Spectrum .sna, .z80 or .szx snapshot and debugs it, stopping at its PC (-r runs it)";
  readonly aliases = ["zxsnap"];
  readonly usage = "zx-snapshot <snapshot-file> [-r | -d]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-r", "-d"]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: SpectrumSnapshotCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!args.file?.trim()) {
      messages.push(validationError("The snapshot file path cannot be empty."));
    } else if (!isSpectrumSnapshotPath(args.file)) {
      messages.push(validationError("The file to load must be a .sna, .z80 or .szx snapshot."));
    }
    if (args["-r"] && args["-d"]) {
      messages.push(validationError("Use only one of -r and -d."));
    }
    const guard = spectrumSnapshotProjectGuard(context.store.getState());
    if (guard) {
      messages.push(validationError(guard));
    }
    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: SpectrumSnapshotCommandArgs
  ): Promise<IdeCommandResult> {
    const file = args.file.trim();
    const mode: SpectrumSnapshotLoadMode = args["-r"] ? "run" : "debug";

    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(file);
    } catch (err) {
      return commandError(`Could not read ${file}: ${messageOf(err)}`);
    }

    // --- Parse here too: the project guard needs the snapshot's machine, and disks need reading
    let snapshot: SpectrumSnapshot;
    try {
      snapshot = parseSpectrumSnapshot(file, bytes);
    } catch (err) {
      return commandError(`${file} is not a valid snapshot: ${messageOf(err)}`);
    }
    const mapping = mapSpectrumSnapshotToKlive(snapshot);
    if (mapping.errors.length) {
      return commandError(`${file} cannot be loaded: ${mapping.errors.join("; ")}`);
    }
    const state = context.store.getState();
    const guard = spectrumSnapshotProjectGuard(state, mapping.machineId);
    if (guard) {
      return commandError(guard);
    }
    const keepModel = !!state.project?.isKliveProject;

    // --- Linked +3 disks
    const disks: { drive: number; fileName: string; contents: Uint8Array }[] = [];
    const diskWarnings: string[] = [];
    for (const disk of snapshot.peripherals.plus3?.disks ?? []) {
      if (disk.embedded) {
        disks.push({ drive: disk.drive, fileName: `drive ${disk.drive ? "B" : "A"} (embedded)`, contents: disk.embedded });
        continue;
      }
      if (!disk.fileName) continue;
      const read = await readFirst(context, diskCandidates(file, disk.fileName));
      if (read) {
        disks.push({ drive: disk.drive, fileName: read.path, contents: read.bytes });
      } else {
        diskWarnings.push(`The disk ${disk.fileName} the snapshot links was not found; drive ${disk.drive ? "B" : "A"} is left as it is`);
      }
    }

    let result: Awaited<ReturnType<typeof context.emuApi.loadSpectrumSnapshot>>;
    try {
      result = await context.emuApi.loadSpectrumSnapshot(file, bytes, mode, { keepModel, disks });
    } catch (err) {
      return commandError(`Could not load ${file}: ${messageOf(err)}`);
    }

    if (result.rebuilt) {
      writeMessage(context.output, `Machine switched to the ${result.machineName}.`, "cyan");
    }
    for (const warning of [...diskWarnings, ...result.warnings]) {
      writeMessage(context.output, `Warning: ${warning}`, "yellow");
    }
    const done = mode === "run" ? "running" : "stopped at";
    return commandSuccessWith(
      `${result.format.toUpperCase()} snapshot ${file} loaded, ${done} PC $${toHexa4(result.pc)}.`
    );
  }
}

/**
 * Why a snapshot cannot be loaded with the current project open, or undefined when it can (D7).
 *
 * Without `snapshotMachineId` (the tab bar and the Explorer, which have not read the file) it refuses
 * only a project whose machine is not a ZX Spectrum. With it, it refuses a project of another
 * Spectrum type too, naming both machines.
 * @param state The IDE's state (the parts read here)
 * @param snapshotMachineId The machine the snapshot maps to
 */
export function spectrumSnapshotProjectGuard(
  state: {
    project?: { folderPath?: string | null; isKliveProject?: boolean };
    emulatorState?: { machineId?: string };
  },
  snapshotMachineId?: string
): string | undefined {
  const machineId = state.emulatorState?.machineId;
  if (!state.project?.isKliveProject) {
    return undefined;
  }
  const nameOf = (id: string | undefined) =>
    machineRegistry.find((m) => m.machineId === id)?.displayName ?? id ?? "another machine";
  if (!machineId || !SPECTRUM_MACHINES.includes(machineId)) {
    return (
      `The open project targets ${nameOf(machineId)}; loading a ZX Spectrum snapshot would switch ` +
      "it to a ZX Spectrum. Close the project or open a ZX Spectrum project first."
    );
  }
  if (snapshotMachineId && snapshotMachineId !== machineId) {
    return (
      `The open project targets the ${nameOf(machineId)}, but this snapshot needs the ` +
      `${nameOf(snapshotMachineId)}. Close the project or open a project for that machine.`
    );
  }
  return undefined;
}

/** Where a linked disk may be: as written, then next to the snapshot (by its file name) */
export function diskCandidates(snapshotPath: string, linked: string): string[] {
  const slash = Math.max(snapshotPath.lastIndexOf("/"), snapshotPath.lastIndexOf("\\"));
  const folder = slash >= 0 ? snapshotPath.substring(0, slash + 1) : "";
  const linkedSlash = Math.max(linked.lastIndexOf("/"), linked.lastIndexOf("\\"));
  const baseName = linked.substring(linkedSlash + 1);
  const isAbsolute = /^([a-zA-Z]:[\\/]|[\\/])/.test(linked);
  const candidates = [isAbsolute ? linked : folder + linked, folder + baseName];
  return [...new Set(candidates)];
}

async function readFirst(
  context: IdeCommandContext,
  paths: string[]
): Promise<{ path: string; bytes: Uint8Array } | undefined> {
  for (const path of paths) {
    try {
      return { path, bytes: await context.mainApi.readBinaryFile(path) };
    } catch {
      // --- Try the next place
    }
  }
  return undefined;
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
