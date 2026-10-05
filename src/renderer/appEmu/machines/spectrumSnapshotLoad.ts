/*
 * Loads a ZX Spectrum snapshot (`.sna`, `.z80`, `.szx`) into the emulator: the orchestration of
 * `.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.5, modelled on `z88SnapshotLoad.ts`.
 *
 *  1. Parse and map the file. Anything Klive cannot load stops here, before the machine is touched.
 *  2. Make the machine fit: the snapshot picks the machine type (D2). A machine of another type, or
 *     a model the snapshot cannot run on, is rebuilt; with `keepModel` (a project is open, D7) a
 *     model of the right type is kept, with a warning.
 *  3. Media first (trap 12): `restoreState` re-attaches the stored media, so a `.szx` file's
 *     embedded tape and its linked disks (read by the IDE) go into the media store before it.
 *  4. Restore the state through `IMachineController.restoreState`, which leaves the machine Paused.
 *  5. Then, by mode: run, or debug, stopping at the snapshot's PC before that instruction runs.
 *
 * The services it needs come in as ports, so the flow is testable without the emulator window.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import type {
  SpectrumSnapshotLoadMode,
  SpectrumSnapshotLoadOptions,
  SpectrumSnapshotLoadResult
} from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";

import { machineRegistry } from "@common/machines/machine-registry";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import {
  kliveSpectrumName,
  mapSpectrumSnapshotToKlive,
  type SpectrumSnapshotMapping
} from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import {
  MC_DISK_SUPPORT,
  MC_MEM_SIZE,
  MC_SCREEN_FREQ,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_SCORPION
} from "@common/machines/constants";
import {
  getP3RomSet,
  P3_MODELS,
  p3ModelDrives,
  p3ModelRomSet
} from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { getSp128Model, getSp128Timing } from "@emu/machines/zxSpectrum128/sp128Timings";
import { getTimexModel } from "@emu/machines/timex/timexModels";

/** The services the load uses */
export type SpectrumSnapshotLoadPorts = {
  /** The live machine controller (it changes when the machine is rebuilt) */
  getMachineController(): IMachineController | undefined;
  /** The emulator's machine type, model and configuration */
  getEmulatorState(): { machineId?: string; modelId?: string; config?: MachineConfigSet };
  /** Rebuilds the machine; false when a later machine change superseded it */
  setMachineType(
    machineId: string,
    modelId: string | undefined,
    config: MachineConfigSet
  ): Promise<boolean>;
  /** Puts a tape image into the deck (the media store and the live machine) */
  setTape(fileName: string, contents: Uint8Array): Promise<void>;
  /** Inserts a disk image into a drive (0 = A, 1 = B) */
  setDisk(drive: number, fileName: string, contents: Uint8Array): Promise<void>;
};

/** A disk the IDE read for a `.szx` file's DSK block */
export type SpectrumSnapshotDiskFile = { drive: number; fileName: string; contents: Uint8Array };

/** The part of the Spectrum machines the load needs (`ZxSpectrum*WasmV2Machine`) */
type SpectrumSnapshotMachine = {
  loadSnapshotState(snapshot: SpectrumSnapshot): number;
};

function isSpectrumSnapshotMachine(machine: unknown): machine is SpectrumSnapshotMachine {
  return typeof (machine as SpectrumSnapshotMachine)?.loadSnapshotState === "function";
}

/**
 * Loads a snapshot into the emulator.
 * @param ports The services to use
 * @param fileName The snapshot's file name (its extension picks the format)
 * @param bytes The snapshot file
 * @param mode What to do once the state is restored
 * @param options Load options (keep the model, disks the IDE read)
 * @throws When the file is not a snapshot, Klive cannot load it, or the machine change was superseded
 */
export async function loadSpectrumSnapshot(
  ports: SpectrumSnapshotLoadPorts,
  fileName: string,
  bytes: Uint8Array,
  mode: SpectrumSnapshotLoadMode,
  options: SpectrumSnapshotLoadOptions & { disks?: SpectrumSnapshotDiskFile[] } = {}
): Promise<SpectrumSnapshotLoadResult> {
  // --- 1. Parse and map
  const snapshot = parseSpectrumSnapshot(fileName, bytes);
  const mapping = mapSpectrumSnapshotToKlive(snapshot);
  if (mapping.errors.length > 0) {
    throw new Error(`The snapshot cannot be loaded: ${mapping.errors.join("; ")}`);
  }

  // --- 2. Make the machine fit
  const fit = fitSpectrumMachine(ports.getEmulatorState(), mapping, snapshot, !!options.keepModel);
  const warnings = [...snapshot.warnings, ...mappingWarnings(mapping, fit), ...fit.warnings];
  if (fit.rebuild) {
    const live = await ports.setMachineType(fit.machineId, fit.modelId, fit.config);
    if (!live) {
      throw new Error("The machine change was superseded by another one; the snapshot was not loaded");
    }
  }
  const controller = ports.getMachineController();
  const machine = controller?.machine;
  if (!controller || !isSpectrumSnapshotMachine(machine)) {
    throw new Error(`The emulator is not running a ${kliveSpectrumName(fit.machineId, fit.modelId)}`);
  }

  // --- 3. Media
  const tape = snapshot.peripherals.tape;
  if (tape?.embedded) {
    const ext = tape.extension === "tap" || tape.extension === "tzx" ? tape.extension : undefined;
    if (ext) {
      await ports.setTape(`${baseName(fileName)} (embedded tape).${ext}`, tape.embedded);
    } else {
      warnings.push(`The embedded .${tape.extension} tape is not a format Klive plays; it was not inserted`);
    }
  } else if (tape?.fileName) {
    warnings.push(`The snapshot links the tape ${tape.fileName}; insert it yourself if you need it`);
  }
  // --- The +2A/+3/+3E's drives, or the Pentagon's Beta 128 drives
  const drives =
    fit.machineId === MI_SPECTRUM_3E
      ? p3ModelDrives(fit.modelId)
      : Number(getSp128Model(fit.modelId)?.config?.[MC_DISK_SUPPORT] ?? 0);
  for (const disk of options.disks ?? []) {
    if (disk.drive >= drives) {
      warnings.push(`The machine has no drive ${disk.drive ? "B" : "A"} for ${disk.fileName}`);
      continue;
    }
    await ports.setDisk(disk.drive, disk.fileName, disk.contents);
  }

  // --- 4. Restore the state, Paused
  await controller.restoreState(() => {
    machine.loadSnapshotState(snapshot);
  }, `${snapshot.format.toUpperCase()} snapshot loaded`);

  // --- 5. Continue as asked
  const pc = snapshot.cpu.pc;
  if (mode === "run") {
    await controller.start();
  } else {
    controller.debugSupport?.addBreakpoint({
      address: pc,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    await controller.startDebug();
  }

  return {
    pc,
    machineId: fit.machineId,
    modelId: fit.modelId,
    machineName: kliveSpectrumName(fit.machineId, fit.modelId),
    rebuilt: fit.rebuild,
    format: snapshot.format,
    warnings
  };
}

/**
 * The mapping's warnings that hold for the model the snapshot opens on: the "+E ROMs instead of the
 * Amstrad ones" warning goes when it stays on an Amstrad model (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md`
 * Phase 3).
 */
function mappingWarnings(
  mapping: SpectrumSnapshotMapping,
  fit: { machineId: string; modelId: string | undefined }
): string[] {
  const onAmstrad = fit.machineId === MI_SPECTRUM_3E && p3ModelRomSet(fit.modelId).amstrad;
  return onAmstrad ? mapping.warnings.filter((w) => w !== mapping.eRomWarning) : mapping.warnings;
}

/**
 * The model a machine without a model id runs, from its configuration: the 48K's memory size and
 * frequency, the 128K machine's timing (the 128K or the Pentagon), the +2A/+3/+2E/+3E's drive count
 * and ROM set.
 */
export function effectiveModelId(machineId: string, config: MachineConfigSet | undefined): string | undefined {
  if (machineId === MI_SPECTRUM_48) {
    if (config?.[MC_MEM_SIZE] === 16) return "pal-16k";
    return config?.[MC_SCREEN_FREQ] === "ntsc" ? "ntsc" : "pal";
  }
  if (machineId === MI_SPECTRUM_128) {
    return getSp128Timing(config).id;
  }
  if (machineId === MI_TIMEX) {
    return getTimexModel(config).id;
  }
  if (machineId === MI_SCORPION) {
    return "zs256";
  }
  if (machineId === MI_SPECTRUM_3E) {
    const raw = config?.[MC_DISK_SUPPORT];
    const drives = raw === 2 ? 2 : raw === 1 ? 1 : 0;
    const romSet = getP3RomSet(config).id;
    const model =
      P3_MODELS.find((m) => p3ModelDrives(m.modelId) === drives && p3ModelRomSet(m.modelId).id === romSet) ??
      P3_MODELS.find((m) => p3ModelDrives(m.modelId) === drives);
    return model?.modelId;
  }
  return undefined;
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

/**
 * The machine a snapshot needs, and whether the current one must be rebuilt for it. Exported for
 * the tests.
 * @param current The emulator's machine type, model and configuration
 * @param mapping The snapshot's mapping
 * @param snapshot The snapshot
 * @param keepModel Keep a model of the right machine type (a project is open, D7)
 */
export function fitSpectrumMachine(
  current: { machineId?: string; modelId?: string; config?: MachineConfigSet },
  mapping: SpectrumSnapshotMapping,
  snapshot: SpectrumSnapshot,
  keepModel: boolean
): {
  rebuild: boolean;
  machineId: string;
  modelId: string | undefined;
  config: MachineConfigSet;
  warnings: string[];
} {
  const machineId = mapping.machineId!;
  const warnings: string[] = [];
  const sameMachine = current.machineId === machineId;
  // --- A project created without a model (`newp sp48 ...`) runs the model its configuration says
  if (sameMachine && current.modelId === undefined) {
    current = { ...current, modelId: effectiveModelId(machineId, current.config) };
  }
  const info = machineRegistry.find((m) => m.machineId === machineId);
  const modelConfig = (modelId: string | undefined) =>
    info?.models?.find((m) => m.modelId === modelId)?.config ?? {};

  if (sameMachine && mapping.modelIds.includes(current.modelId)) {
    return { rebuild: false, machineId, modelId: current.modelId, config: current.config ?? {}, warnings };
  }
  if (sameMachine && keepModel) {
    if (current.modelId === "pal-16k" && snapshot.machine !== "16k") {
      throw new Error(
        "The snapshot needs 48K of RAM, but the project's machine is a ZX Spectrum 16K"
      );
    }
    warnings.push(
      `The snapshot is loaded on the project's ${kliveSpectrumName(machineId, current.modelId)} rather than a ${kliveSpectrumName(machineId, mapping.modelIds[0])}`
    );
    if (machineId === MI_SPECTRUM_3E && p3ModelDrives(current.modelId) === 0 && snapshot.peripherals.plus3?.disks.length) {
      warnings.push("The project's machine has no disk drives; the snapshot's disks are not inserted");
    }
    return { rebuild: false, machineId, modelId: current.modelId, config: current.config ?? {}, warnings };
  }
  const modelId = mapping.modelIds[0];
  // --- The same machine type keeps its other settings (a custom ROM, for example)
  const base = sameMachine ? { ...(current.config ?? {}) } : {};
  return { rebuild: true, machineId, modelId, config: { ...base, ...modelConfig(modelId) }, warnings };
}
